"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "../db";
import { hashPassword, verifyPassword } from "../password";
import { createSession, deleteSession } from "./session";
import { clientIp, resetTokens, takeToken } from "./rate-limit";
import { registrationAllowed } from "../settings";
import { findUsableInvitation } from "../invitations";
import { getI18n } from "@/i18n/server";

export type AuthState =
  | {
      error?: string
      fieldErrors?: Record<string, string[]>
      values?: { email?: string; name?: string }
    }
  | undefined;

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path[0]?.toString() ?? "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/** Invitation déjà consommée entre la vérification et la création. */
class InvitationConsumedError extends Error {}

/** Erreur de contrainte unique Prisma (adresse déjà prise). */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export async function register(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { t } = await getI18n();

  // Anti-abus : limite la création de comptes par IP.
  const ip = await clientIp();
  if (!takeToken(`register:${ip}`, 5, 60 * 60 * 1000)) {
    return { error: t("autherr.rateLimited", { minutes: 60 }) };
  }

  const schema = z.object({
    name: z.string().trim().min(2, t("validation.nameMin")),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email(t("validation.email"))),
    password: z
      .string()
      .min(8, t("validation.passwordMin"))
      .regex(/[a-zA-Z]/, t("validation.passwordLetter"))
      .regex(/[0-9]/, t("validation.passwordDigit")),
  });

  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  const values = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
  };

  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error), values };
  }

  const { name, email, password } = parsed.data;

  // Invitation éventuelle (lien `/register?invite=…`).
  const inviteToken = String(formData.get("invite") ?? "").trim();
  const invitation = inviteToken
    ? await findUsableInvitation(inviteToken)
    : null;

  const userCount = await prisma.user.count();
  const open = userCount === 0 || (await registrationAllowed());

  // Un jeton fourni mais invalide n'est bloquant que si les inscriptions sont
  // fermées ; sinon on l'ignore simplement (lien expiré, etc.).
  if (!open && !invitation) {
    return {
      error: t(inviteToken ? "autherr.inviteInvalid" : "autherr.disabled"),
      values,
    };
  }

  if (invitation?.email && invitation.email !== email) {
    return { error: t("autherr.inviteEmail"), values };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: t("autherr.taken"), values };
  }

  const passwordHash = await hashPassword(password);

  // Création du compte + consommation de l'invitation dans une même
  // transaction : une invitation ne peut pas servir à deux inscriptions
  // concurrentes (l'échec annule la création du compte).
  let user: { id: string };
  try {
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { name, email, passwordHash, isAdmin: userCount === 0 },
      });
      if (invitation) {
        const claimed = await tx.invitation.updateMany({
          where: { id: invitation.id, usedAt: null },
          data: { usedAt: new Date(), usedById: created.id },
        });
        if (claimed.count === 0) throw new InvitationConsumedError();
      }
      return created;
    });
  } catch (error) {
    if (error instanceof InvitationConsumedError) {
      return { error: t("autherr.inviteInvalid"), values };
    }
    if (isUniqueViolation(error)) {
      return { error: t("autherr.taken"), values };
    }
    throw error;
  }

  await createSession(user.id);
  redirect("/dashboard");
}

export async function login(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { t } = await getI18n();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  // Anti force-brute : limite par couple (IP, email) et par IP.
  const ip = await clientIp();
  const userKey = `login:${ip}|${email}`;
  const ipKey = `login-ip:${ip}`;
  if (
    !takeToken(userKey, 10, 15 * 60 * 1000) ||
    !takeToken(ipKey, 30, 15 * 60 * 1000)
  ) {
    return { error: t("autherr.rateLimited", { minutes: 15 }), values: { email } };
  }

  if (!email || !password) {
    return { error: t("autherr.required"), values: { email } };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: t("autherr.credentials"), values: { email } };
  }

  resetTokens(userKey);
  resetTokens(ipKey);
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
