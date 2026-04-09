/**
 * Donation rows from GET /api/tables/donations (SQLite).
 * Amounts in DB are Philippine pesos for Monetary gifts.
 */
export type DonationRow = {
  donation_type?: string | null
  donation_date?: string | null
  amount?: number | string | null
}

/** Approximate PHP per 1 USD for display conversion (DB stores PHP). */
export const PHP_PER_USD = 56

export function phpToUsd(php: number): number {
  if (!Number.isFinite(php) || php <= 0) return 0
  return php / PHP_PER_USD
}

export function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Math.round(n))
}

/** YYYY-MM in local timezone */
export function currentYearMonth(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function sumMonetaryPhpForMonth(rows: DonationRow[], yearMonth: string): number {
  let sum = 0
  for (const r of rows) {
    if (String(r.donation_type ?? '') !== 'Monetary') continue
    const date = String(r.donation_date ?? '')
    if (!date.startsWith(yearMonth)) continue
    const amt = Number(r.amount ?? 0)
    if (Number.isFinite(amt) && amt > 0) sum += amt
  }
  return sum
}

export function sumMonetaryPhpForYear(rows: DonationRow[], year: number): number {
  const prefix = String(year)
  let sum = 0
  for (const r of rows) {
    if (String(r.donation_type ?? '') !== 'Monetary') continue
    const date = String(r.donation_date ?? '')
    if (!date.startsWith(prefix)) continue
    const amt = Number(r.amount ?? 0)
    if (Number.isFinite(amt) && amt > 0) sum += amt
  }
  return sum
}

/**
 * Suggested monthly goal (USD): stretch vs average historical monthly monetary total.
 * Falls back when there is no data.
 */
export function computeMonthlyGoalUsd(
  rows: DonationRow[],
  fallbackUsd = 2500
): number {
  const byMonth = new Map<string, number>()
  for (const r of rows) {
    if (String(r.donation_type ?? '') !== 'Monetary') continue
    const date = String(r.donation_date ?? '')
    if (date.length < 7) continue
    const key = date.slice(0, 7)
    const amt = Number(r.amount ?? 0)
    if (!Number.isFinite(amt) || amt <= 0) continue
    byMonth.set(key, (byMonth.get(key) ?? 0) + amt)
  }
  const totals = [...byMonth.values()]
  if (totals.length === 0) return fallbackUsd
  const avgPhp = totals.reduce((a, b) => a + b, 0) / totals.length
  const avgUsd = phpToUsd(avgPhp)
  const stretch = Math.max(2000, Math.ceil((avgUsd * 1.25) / 100) * 100)
  return stretch
}

export function progressPercent(raised: number, goal: number): number {
  if (goal <= 0) return 0
  return Math.min(100, Math.round((raised / goal) * 1000) / 10)
}
