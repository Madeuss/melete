import { CircleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { errorId, hintId } from './fieldIds'

interface FieldProps {
  /** id of the control; the label points to it and hint/error ids derive from it. */
  id: string
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  children: ReactNode
  /** Extra content on the label row, e.g. a counter. */
  aside?: ReactNode
}

/** Label + control + hint/error. Pass `aria-describedby={describedBy(id, …)}` to the control. */
export function Field({ id, label, hint, error, children, aside }: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-sm font-medium text-text">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {hint && !error && (
        <p id={hintId(id)} className="text-caption text-text-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId(id)} className="flex items-center gap-1.5 text-caption text-danger">
          <CircleAlert size={16} strokeWidth={1.5} aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
}
