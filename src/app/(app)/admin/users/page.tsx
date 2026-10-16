import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { UsersList } from "@/components/users-list";
import { Card, SectionTitle } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

/** Gestion des comptes de l'instance (rôle admin, réinitialisation, suppression). */
export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  const { t } = await getI18n();

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
      <UsersList users={users} selfId={user.id} />
    </Card>
  );
}
