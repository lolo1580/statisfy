/**
 * Périodes pour le récapitulatif : une année complète ou un mois précis.
 * Les bornes sont exprimées en UTC et `to` est exclusif.
 */
export type WrappedPeriod = {
  year: number
  month: number | null
  from: Date
  to: Date
  prevFrom: Date
  prevTo: Date
  label: string
  key: string
  isMonth: boolean
}

export const MONTH_NAMES = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
]

export const MONTH_SHORT = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
]

export function parseWrappedPeriod(
  yearParam?: string,
  monthParam?: string,
  now: Date = new Date(),
): WrappedPeriod {
  const currentYear = now.getUTCFullYear()
  const parsedYear = Number(yearParam)
  const year =
    Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= currentYear + 1
      ? parsedYear
      : currentYear

  const parsedMonth = Number(monthParam)
  const month =
    Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
      ? parsedMonth
      : null

  if (month) {
    const from = new Date(Date.UTC(year, month - 1, 1))
    const to = new Date(Date.UTC(year, month, 1))
    const prevFrom = new Date(Date.UTC(year, month - 2, 1))
    return {
      year,
      month,
      from,
      to,
      prevFrom,
      prevTo: from,
      label: `${MONTH_NAMES[month - 1]} ${year}`,
      key: `${year}-${String(month).padStart(2, '0')}`,
      isMonth: true,
    }
  }

  return {
    year,
    month: null,
    from: new Date(Date.UTC(year, 0, 1)),
    to: new Date(Date.UTC(year + 1, 0, 1)),
    prevFrom: new Date(Date.UTC(year - 1, 0, 1)),
    prevTo: new Date(Date.UTC(year, 0, 1)),
    label: `Année ${year}`,
    key: String(year),
    isMonth: false,
  }
}

/** Noms des mois localisés (janvier..décembre / January..December). */
export function monthNames(locale: string): string[] {
  const formatter = new Intl.DateTimeFormat(locale, {
    month: "long",
    timeZone: "UTC",
  })
  return Array.from({ length: 12 }, (_, i) =>
    formatter.format(new Date(Date.UTC(2021, i, 1))),
  )
}

/** Noms courts des mois localisés. */
export function monthShortNames(locale: string): string[] {
  const formatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "UTC",
  })
  return Array.from({ length: 12 }, (_, i) =>
    formatter.format(new Date(Date.UTC(2021, i, 1))),
  )
}

/** Libellé localisé de la période ("January 2026", "Année 2026"...). */
export function formatPeriodLabel(
  period: WrappedPeriod,
  locale: string,
  yearTemplate: string,
): string {
  if (period.month) {
    return new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(period.year, period.month - 1, 1)))
  }
  return yearTemplate.replace("{year}", String(period.year))
}
