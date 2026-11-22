import { Mic, Square } from 'lucide-react'
import { cn } from './cn'

interface RecordButtonProps {
  recording: boolean
  /** Microphone level 0..1; drives the ring around the button. */
  level?: number
  disabled?: boolean
  onClick: () => void
  label: string
}

/**
 * The signature element of the interview room: big, circular, brand pink,
 * with a ring that follows the microphone volume. The only large pink element on screen.
 */
export function RecordButton({ recording, level = 0, disabled, onClick, label }: RecordButtonProps) {
  const clamped = Math.min(1, Math.max(0, level))
  const scale = recording ? 1.08 + clamped * 0.45 : 1
  return (
    <div className="relative grid size-40 place-items-center">
      <span
        aria-hidden
        className={cn(
          'absolute size-24 rounded-pill bg-brand-soft transition-[transform,opacity] duration-150 ease-out',
          recording ? 'opacity-100' : 'opacity-0',
        )}
        style={{ transform: `scale(${scale})` }}
      />
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={recording}
        className={cn(
          'relative grid size-24 place-items-center rounded-pill bg-brand text-on-brand',
          'transition-[transform,background-color] duration-150 ease-out hover:bg-brand-strong active:scale-95',
          'disabled:pointer-events-none disabled:opacity-50',
        )}
      >
        {recording ? (
          <Square size={28} strokeWidth={1.5} fill="currentColor" aria-hidden />
        ) : (
          <Mic size={34} strokeWidth={1.5} aria-hidden />
        )}
      </button>
    </div>
  )
}
