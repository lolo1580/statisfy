"use client";

import { useActionState } from "react";
import {
  saveWebhook,
  testWebhook,
  type WebhookState,
} from "@/lib/actions/webhooks";
import { useI18n } from "@/components/i18n-provider";
import { Feedback, inputClass } from "@/components/form-ui";

/**
 * Réglage du webhook d'instance : URL, secret de signature et test.
 * Le test utilise toujours la configuration **enregistrée**.
 */
export function WebhookForm({ url, secret }: { url: string; secret: string }) {
  const { t } = useI18n();
  const [saveState, saveAction, saving] = useActionState<
    WebhookState,
    FormData
  >(saveWebhook, undefined);
  const [testState, testAction, testing] = useActionState<
    WebhookState,
    FormData
  >(testWebhook, undefined);

  return (
    <div className="space-y-5">
      <form action={saveAction} className="space-y-3">
        <label className="block space-y-1 text-xs text-muted">
          <span>{t("admin.webhookUrl")}</span>
          <input
            type="url"
            name="url"
            defaultValue={url}
            placeholder={t("admin.webhookUrlPlaceholder")}
            className={inputClass}
          />
        </label>
        <label className="block space-y-1 text-xs text-muted">
          <span>{t("admin.webhookSecret")}</span>
          <input
            type="password"
            name="secret"
            defaultValue={secret}
            autoComplete="off"
            className={inputClass}
          />
        </label>
        <p className="text-xs text-muted">{t("admin.webhookHint")}</p>
        <Feedback state={saveState} />
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? t("admin.webhookSaving") : t("admin.webhookSave")}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <form action={testAction}>
          <button
            type="submit"
            disabled={testing || !url}
            className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-50"
          >
            {testing ? t("admin.webhookTesting") : t("admin.webhookTest")}
          </button>
        </form>
        <Feedback state={testState} />
      </div>
    </div>
  );
}
