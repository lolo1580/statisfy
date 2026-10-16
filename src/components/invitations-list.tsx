"use client";

import { useState } from "react";
import {
  createInvitationAction,
  revokeInvitation,
} from "@/lib/actions/users";
import { CopyField } from "@/components/admin-forms";
import { Spinner, useOptimisticList } from "@/components/optimistic";
import { createTempId, type OptimisticMeta } from "@/lib/optimistic";
import { INVITATION_TTL_CHOICES } from "@/lib/invitation-rules";
import { useI18n } from "@/components/i18n-provider";
import { Badge, EmptyState } from "@/components/ui";
import { inputClass } from "@/components/form-ui";
import { formatDateTime } from "@/lib/format";

/** Ligne d'invitation telle qu'affichée (données serveur + métadonnées client). */
export type InvitationRow = {
  id: string;
  token: string;
  email: string | null;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  /** Calculé côté serveur pour éviter toute horloge client pendant le rendu. */
  usable: boolean;
} & OptimisticMeta;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Formulaire de création + liste des invitations, avec mise à jour optimiste :
 * la nouvelle invitation apparaît aussitôt (identifiant temporaire, statut
 * « création ») puis est remplacée par la ligne renvoyée par le serveur.
 */
export function InvitationsList({
  invitations,
  origin,
  timezone,
}: {
  invitations: InvitationRow[];
  origin: string;
  timezone: string;
}) {
  const { t, locale } = useI18n();
  const { items, errors, dismissError, isPending, create, remove } =
    useOptimisticList(invitations, { fallbackError: t("err.actionFailed") });

  const [email, setEmail] = useState("");
  const [days, setDays] = useState(String(INVITATION_TTL_CHOICES[1] ?? 7));
  const [localError, setLocalError] = useState<string | null>(null);
  const formError = localError ?? errors.new;
  const creating = isPending("new");

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (trimmed && !EMAIL_RE.test(trimmed)) {
      setLocalError(t("validation.email"));
      return;
    }
    setLocalError(null);

    const parsedDays = Number(days) || INVITATION_TTL_CHOICES[1] || 7;
    const now = new Date();
    create(
      {
        id: createTempId("invite"),
        token: "",
        email: trimmed || null,
        createdAt: now,
        expiresAt: new Date(now.getTime() + parsedDays * DAY_MS),
        usedAt: null,
        usable: true,
        syncing: true,
      },
      async () => {
        const formData = new FormData();
        formData.set("email", trimmed);
        formData.set("days", String(parsedDays));
        const result = await createInvitationAction(undefined, formData);
        if (result?.error) return { error: result.error };
        return { ok: true };
      },
      { position: "start" },
    );
    setEmail("");
  };

  const revoke = (id: string) => {
    remove(id, async () => {
      const formData = new FormData();
      formData.set("invitationId", id);
      return revokeInvitation(formData);
    });
  };

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1">
          <label htmlFor="invite-email" className="mb-1 block text-xs text-muted">
            {t("settings.inviteEmail")}
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (localError) setLocalError(null);
            }}
            className={inputClass}
            placeholder={t("settings.inviteEmailPlaceholder")}
          />
        </div>
        <div>
          <label htmlFor="invite-days" className="mb-1 block text-xs text-muted">
            {t("settings.inviteDays")}
          </label>
          <select
            id="invite-days"
            name="days"
            value={days}
            onChange={(event) => setDays(event.target.value)}
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {INVITATION_TTL_CHOICES.map((value) => (
              <option key={value} value={value}>
                {t("settings.inviteDaysValue", { days: value })}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {creating ? <Spinner /> : null}
          {creating ? t("settings.inviteCreating") : t("settings.inviteCreate")}
        </button>
      </form>

      {formError ? (
        <p className="text-sm text-danger">{formError}</p>
      ) : null}

      <div className="mt-4">
        {items.length === 0 ? (
          <EmptyState>{t("settings.inviteNone")}</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((invitation) => {
              const usable = invitation.usable;
              const status = invitation.syncing
                ? { tone: "neutral" as const, label: t("settings.inviteCreating") }
                : invitation.usedAt
                  ? { tone: "neutral" as const, label: t("settings.inviteUsed") }
                  : usable
                    ? { tone: "accent" as const, label: t("settings.invitePending") }
                    : { tone: "danger" as const, label: t("settings.inviteExpired") };
              const rowError = errors[invitation.id];
              const pending = invitation.syncing || isPending(invitation.id);

              return (
                <li
                  key={invitation.id}
                  className={`space-y-2 py-3 transition-opacity duration-200 ${
                    pending ? "opacity-60" : "opacity-100"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {pending ? <Spinner className="text-accent" /> : null}
                      <span className="text-sm font-medium">
                        {invitation.email ?? t("settings.anyEmail")}
                      </span>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                    <button
                      type="button"
                      onClick={() => revoke(invitation.id)}
                      disabled={pending}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-danger/40 hover:text-danger disabled:opacity-50"
                    >
                      {t("settings.revoke")}
                    </button>
                  </div>
                  <p className="text-xs text-muted">
                    {t("settings.inviteExpires", {
                      date: formatDateTime(
                        invitation.expiresAt,
                        timezone,
                        locale,
                      ),
                    })}
                  </p>
                  {usable && invitation.token ? (
                    <CopyField
                      value={`${origin}/register?invite=${invitation.token}`}
                    />
                  ) : null}
                  {rowError ? (
                    <button
                      type="button"
                      onClick={() => dismissError(invitation.id)}
                      title={t("settings.dismiss")}
                      className="text-left text-xs text-danger"
                    >
                      {rowError}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
