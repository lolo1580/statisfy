import type { StatsApiPayload } from "./public-stats";

/**
 * Carte SVG publique (« badge ») résumant l'écoute d'un compte.
 *
 * Rendu 100 % texte, sans image distante ni script : le SVG peut être affiché
 * dans un README (GitHub le sert via son proxy d'images) ou embarqué dans une
 * page. Toutes les valeurs viennent de `StatsApiPayload`.
 */

export type StatsCardTheme = "dark" | "light";

export type StatsCardOptions = {
  theme?: StatsCardTheme;
  locale?: string;
};

/** Échappe le texte injecté dans le SVG (noms d'utilisateur, d'artiste…). */
export function escapeXml(value: string): string {
  const map: Record<string, string> = {
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  };
  return value.replace(/[<>&"']/g, (char) => map[char] ?? char);
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function formatNumber(value: number, locale: string, digits = 0): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits > 0 ? 1 : 0,
  }).format(value);
}

/** Construit le SVG (fonction pure, testable). */
export function renderStatsCard(
  payload: StatsApiPayload,
  options: StatsCardOptions = {},
): string {
  const theme = options.theme === "light" ? "light" : "dark";
  const locale = options.locale === "fr" ? "fr-FR" : "en-US";

  const colors =
    theme === "dark"
      ? {
          bg: "#0d1117",
          panel: "#161b22",
          border: "#30363d",
          fg: "#e6edf3",
          muted: "#8b949e",
          accent: "#1db954",
        }
      : {
          bg: "#ffffff",
          panel: "#f6f8fa",
          border: "#d0d7de",
          fg: "#1f2328",
          muted: "#656d76",
          accent: "#1a7f37",
        };

  const name = escapeXml(truncate(payload.user, 24));
  const hours = formatNumber(payload.allTimeHours, locale, 1);
  const totalPlays = formatNumber(payload.allTimePlays, locale);
  const weekPlays = formatNumber(payload.weekPlays, locale);
  const topArtist = escapeXml(truncate(payload.topArtist ?? "—", 22));
  const topTrack = escapeXml(
    truncate(
      payload.topTrack
        ? `${payload.topTrack} — ${payload.topTrackArtist ?? ""}`
        : "—",
      28,
    ),
  );

  const font =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="180" viewBox="0 0 480 180" role="img" aria-label="Statisfy — ${name}">
  <title>Statisfy — ${name}</title>
  <rect width="480" height="180" rx="16" fill="${colors.bg}"/>
  <rect x="0.5" y="0.5" width="479" height="179" rx="15.5" fill="none" stroke="${colors.border}"/>
  <circle cx="34" cy="34" r="10" fill="${colors.accent}"/>
  <path d="M30 29.5v9.5M34 27v14M38 31v6" stroke="${colors.bg}" stroke-width="2" stroke-linecap="round"/>
  <text x="52" y="39" font-family="${font}" font-size="13" font-weight="700" letter-spacing="1.5" fill="${colors.muted}">STATISFY</text>
  <text x="24" y="78" font-family="${font}" font-size="15" font-weight="600" fill="${colors.fg}">${name}</text>
  <text x="24" y="122" font-family="${font}" font-size="38" font-weight="800" fill="${colors.accent}">${hours}<tspan font-size="18" font-weight="600" fill="${colors.muted}"> h</tspan></text>
  <text x="24" y="148" font-family="${font}" font-size="12" fill="${colors.muted}">${formatNumber(payload.plays, locale)} ${escapeXml(locale === "fr-FR" ? "écoutes sur la période" : "plays in period")}</text>
  <g>
    <rect x="268" y="20" width="192" height="62" rx="10" fill="${colors.panel}" stroke="${colors.border}"/>
    <text x="282" y="44" font-family="${font}" font-size="11" fill="${colors.muted}">${locale === "fr-FR" ? "ÉCOUTES (TOTAL)" : "TOTAL PLAYS"}</text>
    <text x="282" y="68" font-family="${font}" font-size="22" font-weight="700" fill="${colors.fg}">${totalPlays}</text>
  </g>
  <g>
    <rect x="268" y="90" width="192" height="30" rx="8" fill="${colors.panel}" stroke="${colors.border}"/>
    <text x="280" y="110" font-family="${font}" font-size="11" fill="${colors.muted}">${locale === "fr-FR" ? "7 DERNIERS JOURS" : "LAST 7 DAYS"}</text>
    <text x="446" y="110" font-family="${font}" font-size="13" font-weight="700" fill="${colors.fg}" text-anchor="end">${weekPlays}</text>
  </g>
  <text x="268" y="138" font-family="${font}" font-size="10" fill="${colors.muted}">${locale === "fr-FR" ? "ARTISTE TOP" : "TOP ARTIST"}</text>
  <text x="268" y="153" font-family="${font}" font-size="12" font-weight="600" fill="${colors.fg}">${topArtist}</text>
  <text x="268" y="170" font-family="${font}" font-size="10" fill="${colors.muted}">${topTrack}</text>
</svg>`;
}
