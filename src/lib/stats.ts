/**
 * Agrégations statistiques — point d'entrée public.
 *
 * Le code est découpé par domaine dans `src/lib/stats/` :
 * - `shared`    : filtres de période et helpers SQL communs ;
 * - `overview`  : totaux et fenêtres ;
 * - `rankings`  : classements (titres, artistes, albums, genres) ;
 * - `timeline`  : séries quotidiennes et horaires ;
 * - `entities`  : fiches artiste/titre, écoutes récentes et recherche ;
 * - `wrapped`   : agrégats du récapitulatif ;
 * - `insights`  : redécouvertes, records et habitudes d'écoute.
 *
 * Les imports historiques `@/lib/stats` restent valides grâce à ce barrel.
 */
export * from "./stats/shared";
export * from "./stats/overview";
export * from "./stats/rankings";
export * from "./stats/timeline";
export * from "./stats/entities";
export * from "./stats/wrapped";
export * from "./stats/insights";
