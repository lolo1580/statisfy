"use client";

import { useActionState, useRef, useState } from "react";
import {
  enrichImages,
  importHistory,
  importYourSpotify,
  syncConnection,
  type SettingsState,
} from "@/lib/actions/connections";
import {
  requestSpotifyAccess,
  type SpotifyAccessState,
} from "@/lib/actions/spotify-access";
import { useI18n } from "@/components/i18n-provider";
import { Feedback, inputClass } from "@/components/form-ui";
import {
  ImportProgressBar,
  newImportRunId,
  useImportProgress,
} from "@/components/import-progress";

export function SyncButton({ connectionId }: { connectionId: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    syncConnection,
    undefined,
  );

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={action}>
        <input type="hidden" name="connectionId" value={connectionId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-50"
        >
          {pending ? t("settings.syncing") : t("settings.sync")}
        </button>
      </form>
      {state?.error ? (
        <span className="max-w-[220px] text-right text-xs text-danger">
          {state.error}
        </span>
      ) : null}
      {state?.message ? (
        <span className="max-w-[220px] text-right text-xs text-accent">
          {state.message}
        </span>
      ) : null}
    </div>
  );
}

export function ImportForm() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    importHistory,
    undefined,
  );
  const runIdRef = useRef<HTMLInputElement>(null);
  const [runId, setRunId] = useState("");
  const job = useImportProgress(pending, runId);

  return (
    <form
      action={action}
      className="space-y-3"
      onSubmit={() => {
        // Nouvel identifiant à chaque soumission : le client peut suivre le job.
        const id = newImportRunId();
        setRunId(id);
        if (runIdRef.current) runIdRef.current.value = id;
      }}
    >
      <input ref={runIdRef} type="hidden" name="runId" defaultValue="" />
      <input
        type="file"
        name="files"
        accept=".json,.zip,application/json,application/zip"
        multiple
        className="block w-full cursor-pointer rounded-lg border border-dashed border-border bg-surface-2 px-3 py-6 text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-accent"
      />
      <p className="text-xs text-muted">{t("settings.importHint")}</p>
      {pending ? <ImportProgressBar job={job} /> : null}
      <Feedback state={state} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("settings.importing") : t("settings.importCta")}
      </button>
    </form>
  );
}

export function YourSpotifyImportForm() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    importYourSpotify,
    undefined,
  );
  const runIdRef = useRef<HTMLInputElement>(null);
  const [runId, setRunId] = useState("");
  const job = useImportProgress(pending, runId);

  return (
    <form
      action={action}
      className="space-y-3"
      onSubmit={() => {
        const id = newImportRunId();
        setRunId(id);
        if (runIdRef.current) runIdRef.current.value = id;
      }}
    >
      <input ref={runIdRef} type="hidden" name="runId" defaultValue="" />
      <input
        type="file"
        name="files"
        accept=".bson,.json,.zip"
        multiple
        className="block w-full cursor-pointer rounded-lg border border-dashed border-border bg-surface-2 px-3 py-6 text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-accent"
      />
      <p className="text-xs text-muted">{t("settings.yourspotifyHint")}</p>
      {pending ? <ImportProgressBar job={job} /> : null}
      <Feedback state={state} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("settings.importing") : t("settings.importCta")}
      </button>
    </form>
  );
}

export function EnrichButton() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    enrichImages,
    undefined,
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{t("settings.enrichHint")}</p>
      <form action={action}>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-50"
        >
          {pending ? t("settings.enriching") : t("settings.enrich")}
        </button>
      </form>
      <Feedback state={state} />
    </div>
  );
}

/** Demande d'accès à l'API Spotify (validation par un administrateur). */
export function SpotifyRequestForm({
  defaultAccount,
}: {
  defaultAccount?: string;
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<SpotifyAccessState, FormData>(
    requestSpotifyAccess,
    undefined,
  );

  return (
    <div className="space-y-2">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1">
          <label
            htmlFor="spotify-account"
            className="mb-1 block text-xs text-muted"
          >
            {t("settings.spotifyAccount")}
          </label>
          <input
            id="spotify-account"
            name="account"
            defaultValue={defaultAccount}
            maxLength={200}
            className={inputClass}
            placeholder={t("settings.spotifyAccountPlaceholder")}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending
            ? t("settings.spotifyRequesting")
            : t("settings.spotifyRequestCta")}
        </button>
      </form>
      <Feedback state={state} />
    </div>
  );
}
