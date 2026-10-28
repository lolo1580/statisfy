"use client";

import { deleteUser, setUserAdmin } from "@/lib/actions/users";
import { ResetPasswordButton } from "@/components/admin-forms";
import { Spinner, useOptimisticList } from "@/components/optimistic";
import type { OptimisticMeta } from "@/lib/optimistic";
import { useI18n } from "@/components/i18n-provider";
import { Badge } from "@/components/ui";
import { formatNumber } from "@/lib/format";

/** Compte tel qu'affiché dans la gestion de l'instance. */
export type UserRow = {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  _count: { plays: number; connections: number };
} & OptimisticMeta;

/**
 * Liste des comptes avec bascule de rôle et suppression optimistes : le badge
 * « Admin » et la ligne disparaissent immédiatement, puis reviennent si le
 * serveur refuse (dernier admin, session expirée…).
 */
export function UsersList({
  users,
  selfId,
}: {
  users: UserRow[];
  selfId: string;
}) {
  const { t, locale } = useI18n();
  const { items, errors, dismissError, isPending, update, remove } =
    useOptimisticList(users, { fallbackError: t("err.actionFailed") });

  const toggleAdmin = (member: UserRow) => {
    const nextAdmin = !member.isAdmin;
    update(member.id, { isAdmin: nextAdmin, syncing: true }, async () => {
      const formData = new FormData();
      formData.set("userId", member.id);
      formData.set("isAdmin", String(nextAdmin));
      return setUserAdmin(formData);
    });
  };

  const removeUser = (member: UserRow) => {
    if (
      !window.confirm(t("settings.confirmDeleteUser", { name: member.name }))
    ) {
      return;
    }
    remove(member.id, async () => {
      const formData = new FormData();
      formData.set("userId", member.id);
      return deleteUser(formData);
    });
  };

  return (
    <ul className="divide-y divide-border">
      {items.map((member) => {
        const rowError = errors[member.id];
        const pending = member.syncing || isPending(member.id);

        return (
          <li
            key={member.id}
            className={`flex flex-wrap items-center justify-between gap-3 py-3 transition-opacity duration-200 ${
              pending ? "opacity-60" : "opacity-100"
            }`}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {pending ? <Spinner className="text-accent" /> : null}
                <span className="text-sm font-medium">{member.name}</span>
                {member.isAdmin ? (
                  <Badge tone="accent">{t("settings.userAdmin")}</Badge>
                ) : null}
                {member.id === selfId ? (
                  <Badge>{t("settings.you")}</Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {member.email} ·{" "}
                {t("settings.userStats", {
                  plays: formatNumber(member._count.plays, locale),
                  sources: member._count.connections,
                })}
              </p>
              {rowError ? (
                <button
                  type="button"
                  onClick={() => dismissError(member.id)}
                  title={t("settings.dismiss")}
                  className="mt-1 text-left text-xs text-danger"
                >
                  {rowError}
                </button>
              ) : null}
            </div>

            {member.id !== selfId ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleAdmin(member)}
                  disabled={pending}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-50"
                >
                  {member.isAdmin
                    ? t("settings.removeAdmin")
                    : t("settings.makeAdmin")}
                </button>
                <ResetPasswordButton userId={member.id} />
                <button
                  type="button"
                  onClick={() => removeUser(member)}
                  disabled={pending}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-danger/40 hover:text-danger disabled:opacity-50"
                >
                  {t("settings.deleteUser")}
                </button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
