"use client";

import { useEffect, useState, useActionState } from "react";
import {
  saveRumSettings,
  testRumConnection,
  type RumState,
} from "@/lib/actions/rum";
import { useI18n } from "@/components/i18n-provider";
import { useToast } from "@/components/toast";
import { Feedback, inputClass } from "@/components/form-ui";
import type { RumPrivacyLevel, RumSettings } from "@/lib/rum-types";

type FormSettings = Omit<RumSettings, "token">;

/** Formulaire d'administration du SDK OpenObserve RUM. */
export function RumForm({
  settings,
  hasToken,
  tokenHint,
  forcedOff,
}: {
  settings: FormSettings;
  hasToken: boolean;
  tokenHint: string | null;
  forcedOff: boolean;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [saveState, saveAction, saving] = useActionState<RumState, FormData>(
    saveRumSettings,
    undefined,
  );
  const [testState, testAction, testing] = useActionState<RumState, FormData>(
    testRumConnection,
    undefined,
  );
  const [privacy, setPrivacy] = useState<RumPrivacyLevel>(settings.privacy);
  const [replay, setReplay] = useState(settings.startSessionReplay);

  useEffect(() => {
    if (saveState?.message) toast(saveState.message);
    else if (saveState?.error) toast(saveState.error, "error");
  }, [saveState, toast]);

  useEffect(() => {
    if (testState?.message) toast(testState.message);
    else if (testState?.error) toast(testState.error, "error");
  }, [testState, toast]);

  return (
    <form action={saveAction} className="space-y-5">
      {forcedOff ? (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {t("admin.rumForcedOff")}
        </p>
      ) : null}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={
            settings.enabled && hasToken && Boolean(settings.url) && !forcedOff
          }
          disabled={forcedOff}
        />
        {t("admin.rumEnable")}
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs text-muted sm:col-span-2">
          <span>{t("admin.rumUrl")}</span>
          <input
            type="text"
            inputMode="url"
            name="url"
            defaultValue={settings.url}
            placeholder={t("admin.rumUrlPlaceholder")}
            className={inputClass}
          />
        </label>
        <label className="space-y-1 text-xs text-muted">
          <span>{t("admin.rumOrg")}</span>
          <input
            name="org"
            defaultValue={settings.org}
            className={inputClass}
          />
        </label>
        <label className="space-y-1 text-xs text-muted">
          <span>{t("admin.rumSampleRate")}</span>
          <input
            type="number"
            name="sampleRate"
            min={0}
            max={100}
            step={1}
            defaultValue={settings.sampleRate}
            className={inputClass}
          />
        </label>
        <label className="space-y-1 text-xs text-muted sm:col-span-2">
          <span>{t("admin.rumToken")}</span>
          <input
            type="password"
            name="token"
            defaultValue=""
            autoComplete="off"
            placeholder={hasToken ? (tokenHint ?? "••••") : undefined}
            className={inputClass}
          />
          <span className="block text-[11px] text-muted">
            {hasToken
              ? t("admin.rumTokenKeep", { hint: tokenHint ?? "••••" })
              : t("admin.rumTokenHint")}
          </span>
        </label>
        <label className="space-y-1 text-xs text-muted">
          <span>{t("admin.rumPrivacy")}</span>
          <select
            name="privacy"
            value={privacy}
            onChange={(event) =>
              setPrivacy(event.target.value as RumPrivacyLevel)
            }
            className={inputClass}
          >
            <option value="mask-user-input">
              {t("admin.rumPrivacyMaskInput")}
            </option>
            <option value="mask">{t("admin.rumPrivacyMask")}</option>
            <option value="allow">{t("admin.rumPrivacyAllow")}</option>
          </select>
          {privacy === "allow" ? (
            <span className="block text-[11px] text-danger">
              {t("admin.rumPrivacyAllowWarning")}
            </span>
          ) : null}
        </label>
      </div>

      <details className="rounded-xl border border-border px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">
          {t("admin.rumAdvanced")}
        </summary>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs text-muted">
            <span>{t("admin.rumApplicationId")}</span>
            <input
              name="applicationId"
              defaultValue={settings.applicationId}
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-xs text-muted">
            <span>{t("admin.rumService")}</span>
            <input
              name="service"
              defaultValue={settings.service}
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-xs text-muted">
            <span>{t("admin.rumEnv")}</span>
            <input
              name="env"
              defaultValue={settings.env}
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-xs text-muted">
            <span>{t("admin.rumPersistence")}</span>
            <select
              name="persistence"
              defaultValue={settings.persistence}
              className={inputClass}
            >
              <option value="memory">{t("admin.rumPersistenceMemory")}</option>
              <option value="cookie">{t("admin.rumPersistenceCookie")}</option>
              <option value="local-storage">
                {t("admin.rumPersistenceLocalStorage")}
              </option>
            </select>
            <span className="block text-[11px] text-muted">
              {t("admin.rumPersistenceHint")}
            </span>
          </label>
          <label className="space-y-1 text-xs text-muted">
            <span>{t("admin.rumReplaySampleRate")}</span>
            <input
              type="number"
              name="replaySampleRate"
              min={0}
              max={100}
              step={1}
              defaultValue={settings.sessionReplaySampleRate}
              className={inputClass}
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="trackResources"
              defaultChecked={settings.trackResources}
            />
            {t("admin.rumTrackResources")}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="trackLongTasks"
              defaultChecked={settings.trackLongTasks}
            />
            {t("admin.rumTrackLongTasks")}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="trackInteractions"
              defaultChecked={settings.trackUserInteractions}
            />
            {t("admin.rumTrackInteractions")}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="logsEnabled"
              defaultChecked={settings.logsEnabled}
            />
            {t("admin.rumLogs")}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="forwardErrorsToLogs"
              defaultChecked={settings.forwardErrorsToLogs}
            />
            {t("admin.rumForwardErrors")}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="startReplay"
              checked={replay}
              onChange={(event) => setReplay(event.target.checked)}
            />
            {t("admin.rumStartReplay")}
          </label>
        </div>
        {replay ? (
          <p className="mt-2 text-[11px] text-danger">
            {t("admin.rumReplayWarning")}
          </p>
        ) : null}
      </details>

      <Feedback state={saveState} />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? t("admin.rumSaving") : t("admin.rumSave")}
        </button>
        <button
          type="submit"
          formAction={testAction}
          disabled={testing}
          className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-50"
        >
          {testing ? t("admin.rumTesting") : t("admin.rumTest")}
        </button>
        <span className="text-[11px] text-muted">{t("admin.rumTestHint")}</span>
      </div>
      <Feedback state={testState} />
    </form>
  );
}
