/** Types partagés entre le serveur, le proxy et le composant client. */

export type RumPrivacyLevel = "allow" | "mask-user-input" | "mask";
export type RumPersistence = "cookie" | "local-storage" | "memory";

/** Valeurs éditables depuis Administration → Instance. */
export type RumSettings = {
  enabled: boolean;
  url: string;
  org: string;
  token: string;
  applicationId: string;
  service: string;
  env: string;
  sampleRate: number;
  privacy: RumPrivacyLevel;
  persistence: RumPersistence;
  trackResources: boolean;
  trackLongTasks: boolean;
  trackUserInteractions: boolean;
  logsEnabled: boolean;
  forwardErrorsToLogs: boolean;
  sessionReplaySampleRate: number;
  startSessionReplay: boolean;
};

/** Configuration minimale transmise au navigateur (sans le jeton réel). */
export type OpenObserveRumClientConfig = {
  applicationId: string;
  /** Toujours `"proxy"` : le vrai jeton reste côté serveur. */
  clientToken: string;
  site: string;
  organizationIdentifier: string;
  service: string;
  env: string;
  version: string;
  sessionSampleRate: number;
  defaultPrivacyLevel: RumPrivacyLevel;
  sessionPersistence: RumPersistence;
  trackResources: boolean;
  trackLongTasks: boolean;
  trackUserInteractions: boolean;
  logsEnabled: boolean;
  forwardErrorsToLogs: boolean;
  sessionReplaySampleRate: number;
  startSessionReplay: boolean;
  insecureHTTP: boolean;
  /** Endpoint same-origin qui relaie vers OpenObserve. */
  proxy: string;
};

/** Configuration serveur complète (le jeton ne doit jamais être exposé). */
export type OpenObserveRumServerConfig = Omit<
  OpenObserveRumClientConfig,
  "clientToken" | "proxy"
> & {
  clientToken: string;
  /** `http(s)://host[/path]` d'OpenObserve. */
  baseUrl: string;
  proxyPath: string;
};
