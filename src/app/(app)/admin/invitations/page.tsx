import { getCurrentUser } from "@/lib/auth/dal";
import { revokeInvitation } from "@/lib/actions/users";
import { CopyField, InviteForm } from "@/components/admin-forms";
import { listInvitations } from "@/lib/invitations";
import { isInvitationUsable } from "@/lib/invitation-rules";
import { requestOrigin } from "@/lib/sources/spotify-state";
import { appUrl } from "@/lib/env";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

/** Création et suivi des liens d'invitation à l'inscription. */
export default async function AdminInvitationsPage() {
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();

  const invitations = await listInvitations();
  // Origine publique pour construire des liens d'invitation absolus.
  const inviteOrigin = (await requestOrigin()) ?? appUrl;

  return (
    <Card>
      <SectionTitle
        title={t("settings.invitations")}
        subtitle={t("settings.invitationsSubtitle")}
      />
      <InviteForm origin={inviteOrigin} />
      <div className="mt-4">
        {invitations.length === 0 ? (
          <EmptyState>{t("settings.inviteNone")}</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {invitations.map((invitation) => {
              const usable = isInvitationUsable(invitation);
              const status = invitation.usedAt
                ? { tone: "neutral" as const, label: t("settings.inviteUsed") }
                : usable
                  ? { tone: "accent" as const, label: t("settings.invitePending") }
                  : { tone: "danger" as const, label: t("settings.inviteExpired") };
              return (
                <li key={invitation.id} className="space-y-2 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {invitation.email ?? t("settings.anyEmail")}
                      </span>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                    <form action={revokeInvitation}>
                      <input
                        type="hidden"
                        name="invitationId"
                        value={invitation.id}
                      />
                      <button
                        type="submit"
                        className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-red-500/40 hover:text-red-400"
                      >
                        {t("settings.revoke")}
                      </button>
                    </form>
                  </div>
                  <p className="text-xs text-muted">
                    {t("settings.inviteExpires", {
                      date: formatDateTime(
                        invitation.expiresAt,
                        user.timezone,
                        locale,
                      ),
                    })}
                  </p>
                  {usable ? (
                    <CopyField
                      value={`${inviteOrigin}/register?invite=${invitation.token}`}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
