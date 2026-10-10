"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "../db";
import { hashPassword, verifyPassword } from "../password";
import { createSession, deleteSession } from "./session";
import { registrationAllowed } from "../settings";
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

export async function register(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { t } = await getI18n();

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
  const userCount = await prisma.user.count();

  if (userCount > 0 && !(await registrationAllowed())) {
    return { error: t("autherr.disabled"), values };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: t("autherr.taken"), values };
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      isAdmin: userCount === 0,
    },
  });

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

  if (!email || !password) {
    return { error: t("autherr.required"), values: { email } };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: t("autherr.credentials"), values: { email } };
  }

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
