import type { KeyboardEvent } from 'react'
import { cn } from './cn'

interface Option<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  value: T
  options: ReadonlyArray<Option<T>>
  onChange: (value: T) => void
  id?: string
  /** segmented = one pill track (2–4 options); chips = separate wrapping pills (many options). */
  variant?: 'segmented' | 'chips'
  'aria-labelledby'?: string
  'aria-label'?: string
}

/** Single choice among a few options (radiogroup; Tab visits each option, arrows also work). */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  id,
  variant = 'segmented',
  ...aria
}: SegmentedControlProps<T>) {
  const chips = variant === 'chips'
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const forward = e.key === 'ArrowRight' || e.key === 'ArrowDown'
    const back = e.key === 'ArrowLeft' || e.key === 'ArrowUp'
    if (!forward && !back) return
    e.preventDefault()
    const i = options.findIndex((o) => o.value === value)
    const next = options[(i + (forward ? 1 : -1) + options.length) % options.length]
    onChange(next.value)
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)?.focus()
  }

  return (
    <div
      id={id}
      role="radiogroup"
      {...aria}
      onKeyDown={onKeyDown}
      className={cn(
        'flex w-fit max-w-full flex-wrap',
        chips ? 'gap-2' : 'gap-1 rounded-[22px] bg-surface-sunken p-1',
      )}
    >
      {options.map((o) => {
        const selected = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            data-value={o.value}
            // Every option is reachable with Tab (Enter/Space picks it); arrows still move and pick.
            tabIndex={0}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-9 rounded-pill border px-4 text-sm font-medium transition-colors duration-150 ease-out',
              chips
                ? selected
                  ? 'border-transparent bg-brand-soft text-brand-soft-text'
                  : 'border-transparent bg-surface-sunken text-text-muted hover:text-text'
                : selected
                  ? 'border-border bg-bg text-text'
                  : 'border-transparent text-text-muted hover:text-text',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
