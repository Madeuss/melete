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
  'aria-labelledby'?: string
  'aria-label'?: string
}

/** Single choice among a few options (radiogroup with arrow-key navigation). */
export function SegmentedControl<T extends string>({ value, options, onChange, id, ...aria }: SegmentedControlProps<T>) {
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
      className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-[22px] bg-surface-sunken p-1"
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
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-9 rounded-pill border px-4 text-sm font-medium transition-colors duration-150 ease-out',
              selected ? 'border-border bg-bg text-text' : 'border-transparent text-text-muted hover:text-text',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
