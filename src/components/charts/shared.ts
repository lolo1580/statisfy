const MINUTE_MS = 60_000;

/** Échelle « ronde » pour l'axe vertical (en minutes/heures/jours). */
export function axisTicks(maxValue: number): { max: number; ticks: number[] } {
  const steps = [
    1, 2, 5, 10, 15, 30, 60, 120, 180, 360, 720, 1440, 2880, 4320, 7200,
  ];
  const minutes = maxValue / MINUTE_MS;
  for (const step of steps) {
    if (step * 4 >= minutes) {
      return {
        max: step * 4 * MINUTE_MS,
        ticks: [0, step, step * 2, step * 3, step * 4].map(
          (m) => m * MINUTE_MS,
        ),
      };
    }
  }
  const step = Math.ceil(minutes / 4 / 1440) * 1440;
  return {
    max: step * 4 * MINUTE_MS,
    ticks: [0, step, step * 2, step * 3, step * 4].map((m) => m * MINUTE_MS),
  };
}

/** Durée compacte pour l'axe : « 30 min », « 1 h », « 1.5 h ». */
export function compactDuration(ms: number): string {
  if (ms <= 0) return "0";
  const minutes = ms / MINUTE_MS;
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours} h` : `${hours.toFixed(1)} h`;
}

/**
 * Chemin SVG lissé : interpolation cubique monotone (Fritsch–Carlson) qui
 * passe par chaque point sans dépasser au-dessus ni en dessous.
 */
export function smoothLine(
  coords: readonly (readonly [number, number])[],
): string {
  const n = coords.length;
  if (n === 0) return "";
  const start = `M${coords[0][0].toFixed(2)},${coords[0][1].toFixed(2)}`;
  if (n === 1) return start;

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const delta = coords[i + 1][0] - coords[i][0];
    dx.push(delta);
    slope.push(delta === 0 ? 0 : (coords[i + 1][1] - coords[i][1]) / delta);
  }

  // Tangentes initiales, puis lissage des points intérieurs.
  const m: number[] = new Array(n);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i += 1) {
    m[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  }

  // Limite la pente pour garantir la monotonie (pas de rebond).
  for (let i = 0; i < n - 1; i += 1) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * slope[i];
      m[i + 1] = t * b * slope[i];
    }
  }

  let path = start;
  for (let i = 0; i < n - 1; i += 1) {
    const [x0, y0] = coords[i];
    const [x1, y1] = coords[i + 1];
    const c1x = x0 + dx[i] / 3;
    const c1y = y0 + (m[i] * dx[i]) / 3;
    const c2x = x1 - dx[i] / 3;
    const c2y = y1 - (m[i + 1] * dx[i]) / 3;
    path += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${x1.toFixed(2)},${y1.toFixed(2)}`;
  }
  return path;
}

/** Échelle « ronde » pour un axe de comptage (entiers). */
export function countTicks(value: number): { max: number; ticks: number[] } {
  const steps = [
    1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000,
  ];
  for (const step of steps) {
    if (step * 4 >= value) {
      return { max: step * 4, ticks: [0, step, step * 2, step * 3, step * 4] };
    }
  }
  const step = Math.ceil(value / 4 / 10000) * 10000;
  return { max: step * 4, ticks: [0, step, step * 2, step * 3, step * 4] };
}

/** Indices des libellés à afficher sous les barres. */
export function pickLabels(n: number): Set<number> {
  const set = new Set<number>();
  if (n <= 12) {
    for (let i = 0; i < n; i += 1) set.add(i);
    return set;
  }
  const step = Math.ceil(n / 4);
  for (let i = 0; i < n; i += step) set.add(i);
  set.add(n - 1);
  return set;
}
