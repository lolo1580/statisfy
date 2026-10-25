/** Sections de la page « Données personnelles ». */
export const SETTINGS_DATA_SECTIONS = [
  "export",
  "sharing",
  "api",
  "danger",
] as const;

export type SettingsDataSection = (typeof SETTINGS_DATA_SECTIONS)[number];

export function isSettingsDataSection(
  value: unknown,
): value is SettingsDataSection {
  return (
    typeof value === "string" &&
    (SETTINGS_DATA_SECTIONS as readonly string[]).includes(value)
  );
}
