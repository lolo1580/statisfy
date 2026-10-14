"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { getAdminUser, getCurrentUser } from "../auth/dal";
import { hashPassword, verifyPassword } from "../password";
import { readSession } from "../auth/session";
import { clientIp, resetTokens, takeToken } from "../auth/rate-limit";
import { createInvitation, deleteInvitation } from "../invitations";
import { INVITATION_TTL_DAYS } from "../invitation-rules";
import { generateTemporaryPassword } from "../temp-password";
import { getI18n } from "@/i18n/server";

export type AdminState =
  | {
      ok?: boolean;
      error?: string;
      message?: string;
      /** Lien relatif d'une invitation fraîchement créée. */
      inviteUrl?: string;
    }
  | undefined;

/** Active/désactive le rôle administrateur d'un autre compte. */
export async function setUserAdmin(formData: FormData): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) return;

  const userId = String(formData.get("userId") ?? "");
  const makeAdmin = String(formData.get("isAdmin") ?? "") === "true";
  // On ne modifie pas son propre rôle : évite de se verrouiller par erreur.
  if (!userId || userId === admin.id) return;

  let changed = false;
  try {
    // Isolation SERIALIZABLE : deux admins ne peuvent pas se rétrograder
    // concurremment jusqu'à n'en laisser aucun.
    await prisma.$transaction(
      async (tx) => {
        const target = await tx.user.findUnique({ where: { id: userId } });
        if (!target) return;
        // Toujours conserver au moins un administrateur actif.
        if (!makeAdmin && target.isAdmin) {
          const count = await tx.user.count({ where: { isAdmin: true } });
          if (count <= 1) return;
        }
        await tx.user.update({
          where: { id: userId },
          data: { isAdmin: makeAdmin },
        });
        changed = true;
      },
      { isolationLevel: "Serializable" },
    );
  } catch {
    // Course rare (échec de sérialisation) : on ne change rien.
  }
  if (changed) {
    await logEvent({
      level: "info",
      source: "admin",
      message: makeAdmin ? "Rôle admin accordé" : "Rôle admin retiré",
      userId: admin.id,
      meta: { targetUserId: userId },
    });
  }
  revalidatePath("/admin/users");
}

/** Supprime un compte et toutes ses données (cascade). */
export async function deleteUser(formData: FormData): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) return;

  const userId = String(formData.get("userId") ?? "");
  if (!userId || userId === admin.id) return;

  let deleted = false;
  try {
    await prisma.$transaction(
      async (tx) => {
        const target = await tx.user.findUnique({ where: { id: userId } });
        if (!target) return;
        if (target.isAdmin) {
          const count = await tx.user.count({ where: { isAdmin: true } });
          if (count <= 1) return;
        }
        await tx.user.delete({ where: { id: userId } });
        deleted = true;
      },
      { isolationLevel: "Serializable" },
    );
  } catch {
    // Course rare (échec de sérialisation) : on ne supprime rien.
  }
  if (deleted) {
    await logEvent({
      level: "warn",
      source: "admin",
      message: "Compte supprimé",
      userId: admin.id,
      meta: { targetUserId: userId },
    });
  }
  revalidatePath("/admin/users");
}

/** Réinitialise le mot de passe d'un compte et affiche un mot de passe temporaire. */
export async function resetUserPassword(
  _state: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const { t } = await getI18n();
  const admin = await getAdminUser();
  if (!admin) return { error: t("err.forbidden") };

  const userId = String(formData.get("userId") ?? "");
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: t("err.userNotFound") };

  const password = generateTemporaryPassword();
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password) },
  });
  // Révoque les sessions existantes : le mot de passe a changé.
  await prisma.session.deleteMany({ where: { userId } });

  await logEvent({
    level: "warn",
    source: "admin",
    message: "Mot de passe réinitialisé",
    userId: admin.id,
    meta: { targetUserId: userId },
  });
  revalidatePath("/admin/users");
  return { ok: true, message: t("msg.passwordReset", { password }) };
}

/** Crée un lien d'invitation à l'inscription. */
export async function createInvitationAction(
  _state: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const { t } = await getI18n();
  const admin = await getAdminUser();
  if (!admin) return { error: t("err.forbidden") };

  const emailRaw = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 254);
  if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return { error: t("validation.email") };
  }
  const days = Number(formData.get("days")) || INVITATION_TTL_DAYS;

  const invitation = await createInvitation({
    createdById: admin.id,
    email: emailRaw || null,
    days,
  });

  await logEvent({
    level: "info",
    source: "admin",
    message: "Invitation créée",
    userId: admin.id,
    meta: { email: emailRaw || null, days },
  });
  revalidatePath("/admin/invitations");
  return { ok: true, inviteUrl: `/register?invite=${invitation.token}` };
}

/** Révoque une invitation non consommée. */
export async function revokeInvitation(formData: FormData): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) return;
  const id = String(formData.get("invitationId") ?? "");
  if (id) await deleteInvitation(id);
  await logEvent({
    level: "info",
    source: "admin",
    message: "Invitation révoquée",
    userId: admin.id,
    meta: { invitationId: id },
  });
  revalidatePath("/admin/invitations");
}

/** Change le mot de passe de l'utilisateur connecté. */
export async function changePassword(
  _state: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const { t } = await getI18n();
  const user = await getCurrentUser();

  // Anti force-brute du mot de passe courant.
  const ip = await clientIp();
  const rateKey = `change-password:${user.id}:${ip}`;
  if (!takeToken(rateKey, 10, 15 * 60 * 1000)) {
    return { error: t("autherr.rateLimited", { minutes: 15 }) };
  }

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");

  if (next.length < 8 || !/[a-zA-Z]/.test(next) || !/[0-9]/.test(next)) {
    return { error: t("validation.passwordMin") };
  }

  const row = await prisma.user.findUnique({ where: { id: user.id } });
  if (!row || !(await verifyPassword(current, row.passwordHash))) {
    return { error: t("settings.passwordWrong") };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next) },
  });
  // On garde la session courante mais on révoque les autres.
  const session = await readSession();
  await prisma.session.deleteMany({
    where: { userId: user.id, ...(session ? { id: { not: session.sid } } : {}) },
  });
  resetTokens(rateKey);
  revalidatePath("/settings");
  return { ok: true, message: t("settings.passwordChanged") };
}
