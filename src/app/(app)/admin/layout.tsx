import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { AdminNav } from "@/components/admin-nav";
import { getI18n } from "@/i18n/server";
import { appName } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Espace d'administration : réservé aux comptes administrateurs.
 * Le contrôle est fait ici, côté serveur, pour **toutes** les sous-pages.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user.isAdmin) redirect("/dashboard");

  const { t } = await getI18n();
  const pendingRequests = await prisma.user.count({
    where: { spotifyAccessStatus: "pending" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("admin.title")}
        </h1>
        <p className="mt-0.5 text-sm text-muted">
          {t("admin.subtitle", { name: appName })}
        </p>
      </div>
      <AdminNav pendingCount={pendingRequests} />
      {children}
    </div>
  );
}
