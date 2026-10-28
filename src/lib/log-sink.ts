/**
 * Journalisation externe — point d'entrée public.
 *
 * - `log-sink/config`    : types, parsing des variables et état de configuration ;
 * - `log-sink/format`    : construction des charges GELF, syslog, Loki, etc. ;
 * - `log-sink/transport` : files d'attente et envois UDP/TCP/HTTP/fichier.
 */
export * from "./log-sink/config";
export * from "./log-sink/format";
export * from "./log-sink/transport";
