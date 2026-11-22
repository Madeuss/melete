/** Locale-aware formatting helpers (use the current UI language). */

export function formatDate(iso: string, lang: string, withTime = false): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat(lang, withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(d)
}

export function formatNumber(n: number, lang: string, maxFractionDigits = 1): string {
  return new Intl.NumberFormat(lang, { maximumFractionDigits: maxFractionDigits }).format(n)
}
