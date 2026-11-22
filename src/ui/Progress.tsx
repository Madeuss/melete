/** Thin progress bar. The visible label is rendered by the caller. */
export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
      className="h-1.5 w-full overflow-hidden rounded-pill bg-surface-sunken"
    >
      <div
        className="h-full rounded-pill bg-brand transition-[width] duration-200 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
