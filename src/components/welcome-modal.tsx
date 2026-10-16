"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { completeOnboarding } from "@/lib/actions/onboarding";

const STEPS = [1, 2, 3, 4] as const;

/**
 * Accueil (didacticiel) affiché une seule fois, au premier passage sur le
 * tableau de bord. « Passer » ou terminer l'enregistre côté serveur
 * (`onboardedAt`) : il ne réapparaît plus.
 */
export function WelcomeModal({ initialOpen }: { initialOpen: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  const [step, setStep] = useState(0);
  const [, startTransition] = useTransition();

  if (!open) return null;

  const total = STEPS.length;
  const current = STEPS[step];
  const isLast = step === total - 1;

  const close = () => {
    setOpen(false);
    startTransition(async () => {
      await completeOnboarding();
      router.refresh();
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboard-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <p className="text-xs uppercase tracking-wider text-muted">
          {t("onboard.subtitle", { total: String(total) })}
        </p>
        <h2
          id="onboard-title"
          className="mt-1 text-lg font-semibold tracking-tight"
        >
          {t(`onboard.step${current}.title`)}
        </h2>
        <p className="mt-2 text-sm text-muted">
          {t(`onboard.step${current}.body`)}
        </p>

        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" aria-hidden>
            {STEPS.map((s) => (
              <span
                key={s}
                className={`h-1.5 w-6 rounded-full transition-colors ${
                  s <= current ? "bg-accent" : "bg-surface-2"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={close}
              className="rounded-lg px-2 py-1.5 text-xs text-muted transition-colors hover:text-foreground"
            >
              {t("onboard.skip")}
            </button>
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:border-accent/40 hover:text-accent"
              >
                {t("onboard.prev")}
              </button>
            ) : null}
            {isLast ? (
              <button
                type="button"
                onClick={close}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90"
              >
                {t("onboard.finish")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:border-accent/40 hover:text-accent"
              >
                {t("onboard.next")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
