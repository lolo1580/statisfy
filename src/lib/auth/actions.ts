"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "../db";
import { hashPassword, verifyPasswordOrDummy } from "../password";
import { createSession, deleteSession } from "./session";
import { clientIp, resetTokens, takeToken } from "./rate-limit";
import { registrationAllowed } from "../settings";
import { findUsableInvitation } from "../invitations";
import { logEvent } from "../log";
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

  // Anti-abus : limite la création de comptes par IP — ou, si l'IP n'est pas
  // déterminable, par email (jamais par une clé constante, qui bloquerait tout
  // le monde d'un coup).
  const ip = await clientIp();
  const emailForLimit = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const registerKey = ip
    ? `register-ip:${ip}`
    : `register-email:${emailForLimit || "unknown"}`;
  if (!takeToken(registerKey, 5, 60 * 60 * 1000)) {
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
    // Isolation SERIALIZABLE : deux inscriptions concurrentes ne peuvent pas
    // toutes deux obtenir le rôle administrateur du « premier compte ».
    user = await prisma.$transaction(
      async (tx) => {
        const count = await tx.user.count();
        const created = await tx.user.create({
          data: { name, email, passwordHash, isAdmin: count === 0 },
        });
        if (invitation) {
          const claimed = await tx.invitation.updateMany({
            where: { id: invitation.id, usedAt: null },
            data: { usedAt: new Date(), usedById: created.id },
          });
          if (claimed.count === 0) throw new InvitationConsumedError();
        }
        return created;
      },
      { isolationLevel: "Serializable" },
    );
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
  await logEvent({
    level: "info",
    source: "auth",
    message: "Compte créé",
    userId: user.id,
    ip,
    meta: { email, invitation: Boolean(invitation) },
  });
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

  // Anti force-brute : limite par couple (IP, email) et par IP si elle est
  // connue (sinon on ne crée pas de seau global partagé).
  const ip = await clientIp();
  const userKey = `login:${ip ?? "-"}|${email}`;
  const userAllowed = takeToken(userKey, 10, 15 * 60 * 1000);
  const ipAllowed = ip
    ? takeToken(`login-ip:${ip}`, 30, 15 * 60 * 1000)
    : true;
  if (!userAllowed || !ipAllowed) {
    return { error: t("autherr.rateLimited", { minutes: 15 }), values: { email } };
  }

  if (!email || !password) {
    return { error: t("autherr.required"), values: { email } };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Toujours exécuter scrypt (hash factice si le compte n'existe pas) : évite
  // de révéler l'existence d'un email par le temps de réponse.
  const passwordOk = await verifyPasswordOrDummy(password, user?.passwordHash);
  if (!user || !passwordOk) {
    await logEvent({
      level: "warn",
      source: "auth",
      message: "Échec de connexion",
      userId: user?.id ?? null,
      ip,
      meta: { email },
    });
    return { error: t("autherr.credentials"), values: { email } };
  }

  resetTokens(userKey);
  if (ip) resetTokens(`login-ip:${ip}`);
  await createSession(user.id);
  await logEvent({
    level: "info",
    source: "auth",
    message: "Connexion réussie",
    userId: user.id,
    ip,
  });
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
