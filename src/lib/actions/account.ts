"use server";

import { redirect } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { getOptionalUser } from "../auth/dal";
import { deleteSession } from "../auth/session";
import { takeToken } from "../auth/rate-limit";
import { prisma } from "../db";
import { logEvent } from "../log";
import { verifyPassword } from "../password";

export type DeleteAccountState = { error?: string } | undefined;

/**
 * Suppression autonome du compte (RGPD) : exige le mot de passe courant et une
 * confirmation explicite. Toutes les données liées (écoutes, sources, sessions,
 * partages) sont supprimées en cascade.
 *
 * Un administrateur ne peut pas supprimer le **dernier** compte admin : sinon
 * l'instance n'aurait plus personne pour l'administrer.
 */
export async function deleteOwnAccount(
  _state: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const { t } = await getI18n();
  const user = await getOptionalUser();
  if (!user) return { error: t("err.forbidden") };

  if (String(formData.get("confirm") ?? "") !== "on") {
    return { error: t("err.deleteConfirm") };
  }
  const password = String(formData.get("password") ?? "");
  if (!password) return { error: t("err.passwordRequired") };

  // Throttle : évite de tester des mots de passe en boucle depuis une session
  // volée.
  if (!takeToken(`delete-account:${user.id}`, 5, 60 * 60 * 1000)) {
    return { error: t("err.tooManyAttempts") };
  }

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, isAdmin: true },
  });
  if (!row) return { error: t("err.forbidden") };
  if (!(await verifyPassword(password, row.passwordHash))) {
    return { error: t("err.wrongPassword") };
  }

  if (row.isAdmin) {
    const admins = await prisma.user.count({ where: { isAdmin: true } });
    if (admins <= 1) return { error: t("err.lastAdmin") };
  }

  // Journalisé avant la suppression : la clé étrangère passe ensuite à NULL
  // (`onDelete: SetNull`), l'événement reste consultable par les admins.
  await logEvent({
    level: "warn",
    source: "admin",
    message: "Compte supprimé par son propriétaire",
    userId: user.id,
    // Pas d'adresse e-mail dans `meta` : elle ne doit pas survivre à la
    // suppression du compte (droit à l'effacement).
    meta: { selfService: true },
  });

  // Les invitations encore rattachées à cette adresse ne doivent pas survivre
  // au compte (l'invitation consommée garde `usedById`, mis à NULL en cascade).
  await prisma.invitation
    .deleteMany({ where: { email: user.email } })
    .catch(() => undefined);

  await prisma.user.deleteMany({ where: { id: user.id } });
  await deleteSession();
  redirect("/login?deleted=1");
}
