"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { OpenObserveRumClientConfig } from "@/lib/rum-types";
import {
  isSensitiveRumPath,
  isSensitiveRumUrl,
  normalizeRumUrl,
} from "@/lib/rum-url";

/**
 * Charge et initialise le SDK OpenObserve RUM après hydratation.
 *
 * Le SDK est importé dynamiquement : il ne fait pas partie du bundle initial
 * et n'est jamais évalué côté serveur. Il n'est monté que dans le layout
 * authentifié : les pages publiques (login, partages) ne sont pas suivies.
 *
 * Les URLs sont normalisées avant envoi (suppression query/hash, IDs, jetons)
 * et les pages `/settings` et `/admin` sont exclues. Le replay est
 * automatiquement mis en pause sur ces pages sensibles.
 */

type RumApi = {
  init: (config: Record<string, unknown>) => void;
  startSessionReplayRecording: () => void;
  stopSessionReplayRecording: () => void;
};

type EventWithUrls = {
  type?: string;
  view?: { url?: string; referrer?: string };
  resource?: { url?: string };
  error?: { resource?: { url?: string } };
};

let startPromise: Promise<void> | null = null;
let rumInstance: RumApi | null = null;
let replayActive = false;

function normalizeEvent(event: EventWithUrls): boolean {
  const sensitiveView = event.view?.url
    ? isSensitiveRumUrl(event.view.url)
    : false;

  // Une vue ne peut pas être supprimée par beforeSend : on la rédige.
  // Les autres événements d'une page sensible sont supprimés.
  if (sensitiveView && event.type && event.type !== "view") return false;

  if (event.view?.url) {
    event.view.url = normalizeRumUrl(event.view.url) ?? "";
  }
  if (event.view?.referrer) {
    event.view.referrer = isSensitiveRumUrl(event.view.referrer)
      ? ""
      : normalizeRumUrl(event.view.referrer) ?? "";
  }
  if (event.resource?.url) {
    if (isSensitiveRumUrl(event.resource.url)) return false;
    event.resource.url = normalizeRumUrl(event.resource.url) ?? "";
  }
  if (event.error?.resource?.url) {
    if (isSensitiveRumUrl(event.error.resource.url)) return false;
    event.error.resource.url =
      normalizeRumUrl(event.error.resource.url) ?? "";
  }
  return true;
}

/** Les logs peuvent être supprimés sur les pages sensibles. */
function shouldSendLog(event: EventWithUrls): boolean {
  if (event.view?.url && isSensitiveRumUrl(event.view.url)) return false;
  if (event.resource?.url && isSensitiveRumUrl(event.resource.url)) return false;
  return normalizeEvent(event);
}

function startRum(config: OpenObserveRumClientConfig): Promise<void> {
  if (startPromise) return startPromise;
  startPromise = import("@openobserve/browser-rum")
    .then(async ({ openobserveRum }) => {
      rumInstance = openobserveRum as unknown as RumApi;
      openobserveRum.init({
        applicationId: config.applicationId,
        clientToken: config.clientToken,
        site: config.site,
        proxy: config.proxy,
        organizationIdentifier: config.organizationIdentifier,
        service: config.service,
        env: config.env,
        version: config.version,
        sessionSampleRate: config.sessionSampleRate,
        sessionReplaySampleRate: config.sessionReplaySampleRate,
        sessionPersistence: config.sessionPersistence,
        defaultPrivacyLevel: config.defaultPrivacyLevel,
        trackResources: config.trackResources,
        trackLongTasks: config.trackLongTasks,
        trackUserInteractions: config.trackUserInteractions,
        beforeSend: (event) => normalizeEvent(event as EventWithUrls),
        apiVersion: "v1",
        insecureHTTP: config.insecureHTTP,
        telemetrySampleRate: 0,
        compressIntakeRequests: false,
        silentMultipleInit: true,
      });

      if (
        config.startSessionReplay &&
        config.sessionReplaySampleRate > 0 &&
        !isSensitiveRumPath(window.location.pathname)
      ) {
        openobserveRum.startSessionReplayRecording();
        replayActive = true;
      }

      if (config.logsEnabled) {
        try {
          const { openobserveLogs } = await import(
            "@openobserve/browser-logs"
          );
          openobserveLogs.init({
            clientToken: config.clientToken,
            site: config.site,
            proxy: config.proxy,
            organizationIdentifier: config.organizationIdentifier,
            service: config.service,
            env: config.env,
            version: config.version,
            forwardErrorsToLogs: config.forwardErrorsToLogs,
            beforeSend: (event) => shouldSendLog(event as EventWithUrls),
            apiVersion: "v1",
            insecureHTTP: config.insecureHTTP,
            sessionSampleRate: config.sessionSampleRate,
            sessionPersistence: config.sessionPersistence,
            telemetrySampleRate: 0,
            silentMultipleInit: true,
          });
        } catch (error) {
          console.warn(
            "[statisfy] OpenObserve Logs initialization failed",
            error instanceof Error ? error.message : String(error),
          );
        }
      }
    })
    .catch((error) => {
      console.warn(
        "[statisfy] OpenObserve RUM initialization failed",
        error instanceof Error ? error.message : String(error),
      );
    });
  return startPromise;
}

function userOptedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return (
    nav.doNotTrack === "1" ||
    nav.doNotTrack === "yes" ||
    nav.globalPrivacyControl === true
  );
}

export function OpenObserveRum({
  config,
}: {
  config: OpenObserveRumClientConfig | null;
}) {
  const pathname = usePathname();

  useEffect(() => {
    if (!config || typeof window === "undefined") return;
    if (userOptedOut()) return;
    // Ne pas initialiser le SDK sur une page sensible (chargement direct).
    if (isSensitiveRumPath(pathname)) return;
    void startRum(config);
  }, [config, pathname]);

  useEffect(() => {
    if (!config) {
      if (rumInstance && replayActive) {
        rumInstance.stopSessionReplayRecording();
        replayActive = false;
      }
      return;
    }
    if (
      !rumInstance ||
      !config.startSessionReplay ||
      config.sessionReplaySampleRate <= 0
    ) {
      return;
    }
    const sensitive = isSensitiveRumPath(pathname);
    if (sensitive && replayActive) {
      rumInstance.stopSessionReplayRecording();
      replayActive = false;
    } else if (!sensitive && !replayActive) {
      rumInstance.startSessionReplayRecording();
      replayActive = true;
    }
  }, [config, pathname]);

  return null;
}
