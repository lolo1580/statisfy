import { getCurrentUser } from "@/lib/auth/dal";
import { InvitationsList } from "@/components/invitations-list";
import { listInvitations } from "@/lib/invitations";
import { isInvitationUsable } from "@/lib/invitation-rules";
import { requestOrigin } from "@/lib/sources/spotify-state";
import { appUrl } from "@/lib/env";
import { Card, SectionTitle } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

/** Création et suivi des liens d'invitation à l'inscription. */
export default async function AdminInvitationsPage() {
  const user = await getCurrentUser();
  const { t } = await getI18n();

  const invitations = await listInvitations();
  // Origine publique pour construire des liens d'invitation absolus.
  const inviteOrigin = (await requestOrigin()) ?? appUrl;

  // L'utilisabilité dépend de l'heure serveur : on la fige à la requête RSC
  // plutôt que de lire l'horloge client pendant le rendu.
  const rows = invitations.map((invitation) => ({
    ...invitation,
    usable: isInvitationUsable(invitation),
  }));

  return (
    <Card>
      <SectionTitle
        title={t("settings.invitations")}
        subtitle={t("settings.invitationsSubtitle")}
      />
      <InvitationsList
        invitations={rows}
        origin={inviteOrigin}
        timezone={user.timezone}
      />
    </Card>
  );
}
