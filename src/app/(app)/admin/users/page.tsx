import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { deleteUser, setUserAdmin } from "@/lib/actions/users";
import { ResetPasswordButton } from "@/components/admin-forms";
import { ConfirmForm } from "@/components/confirm-form";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

/** Gestion des comptes de l'instance (rôle admin, réinitialisation, suppression). */
export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      isAdmin: true,
      _count: { select: { plays: true, connections: true } },
    },
  });

  return (
    <Card>
      <SectionTitle
        title={t("settings.users")}
        subtitle={t("settings.usersSubtitle")}
      />
      <ul className="divide-y divide-border">
        {users.map((member) => (
          <li
            key={member.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{member.name}</span>
                {member.isAdmin ? (
                  <Badge tone="accent">{t("settings.userAdmin")}</Badge>
                ) : null}
                {member.id === user.id ? (
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
            </div>
            {member.id !== user.id ? (
              <div className="flex flex-wrap items-center gap-2">
                <form action={setUserAdmin}>
                  <input type="hidden" name="userId" value={member.id} />
                  <input
                    type="hidden"
                    name="isAdmin"
                    value={member.isAdmin ? "false" : "true"}
                  />
                  <button
                    type="submit"
                    className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent/40 hover:text-accent"
                  >
                    {member.isAdmin
                      ? t("settings.removeAdmin")
                      : t("settings.makeAdmin")}
                  </button>
                </form>
                <ResetPasswordButton userId={member.id} />
                <ConfirmForm
                  action={deleteUser}
                  fields={{ userId: member.id }}
                  message={t("settings.confirmDeleteUser", {
                    name: member.name,
                  })}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-red-500/40 hover:text-red-400"
                >
                  {t("settings.deleteUser")}
                </ConfirmForm>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
