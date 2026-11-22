import { X } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

const base =
  'inline-flex items-center gap-1.5 rounded-pill text-sm font-medium transition-colors duration-150 ease-out'

/** Static tag, optionally removable. */
export function Chip({
  children,
  onRemove,
  removeLabel,
}: {
  children: ReactNode
  onRemove?: () => void
  removeLabel?: string
}) {
  return (
    <span className={cn(base, 'h-8 bg-surface-sunken text-text-muted', onRemove ? 'pl-3.5 pr-1.5' : 'px-3.5')}>
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="grid size-5 place-items-center rounded-pill hover:bg-border hover:text-text"
        >
          <X size={14} strokeWidth={1.5} aria-hidden />
        </button>
      )}
    </span>
  )
}

interface ToggleChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  selected: boolean
  onSelectedChange?: (selected: boolean) => void
}

/** Selectable chip (aria-pressed). */
export function ToggleChip({ selected, onSelectedChange, className, onClick, ...rest }: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={(e) => {
        onClick?.(e)
        onSelectedChange?.(!selected)
      }}
      className={cn(
        base,
        'h-9 px-4',
        selected ? 'bg-brand-soft text-brand-soft-text' : 'bg-surface-sunken text-text-muted hover:text-text',
        className,
      )}
      {...rest}
    />
  )
}
