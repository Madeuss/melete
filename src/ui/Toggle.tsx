import { useId, type ReactNode } from 'react'
import { cn } from './cn'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
}

/** Switch with a label on the left. */
export function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="text-sm font-medium text-text">
          {label}
        </label>
        {description && (
          <p id={`${id}-d`} className="text-caption text-text-subtle">
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-d` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-pill transition-colors duration-150 ease-out disabled:opacity-50',
          checked ? 'bg-brand-strong' : 'bg-border-strong',
        )}
      >
        <span
          className={cn(
            'absolute top-1 left-1 size-5 rounded-pill bg-on-brand transition-transform duration-150 ease-out',
            checked && 'translate-x-5',
          )}
        />
      </button>
    </div>
  )
}
