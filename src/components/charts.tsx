/**
 * Graphiques SVG sans dépendance — point d'entrée public.
 *
 * Chaque type de graphique vit dans `src/components/charts/` :
 * `area-chart`, `compare-chart`, `bars-chart`, `rank-bars` et `heatmaps`.
 * Les helpers d'échelle et de lissage sont partagés dans `charts/shared`.
 */
export { AreaChart } from "./charts/area-chart";
export { CompareChart } from "./charts/compare-chart";
export { BarsChart } from "./charts/bars-chart";
export { RankBars } from "./charts/rank-bars";
export { Heatmap, WeekdayHourHeatmap } from "./charts/heatmaps";
