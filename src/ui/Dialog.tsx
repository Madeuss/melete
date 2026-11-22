import { useEffect, useRef, type ReactNode } from 'react'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  children?: ReactNode
  actions: ReactNode
}

/** Modal on top of the native <dialog> (focus trap and Esc for free). */
export function Dialog({ open, onClose, title, children, actions }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal?.()
    if (!open && el.open) el.close?.()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-panel bg-bg p-8 text-text shadow-float backdrop:bg-text/30"
    >
      {open && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg">{title}</h2>
            {children && <div className="text-sm text-text-muted">{children}</div>}
          </div>
          <div className="flex flex-wrap justify-end gap-3">{actions}</div>
        </div>
      )}
    </dialog>
  )
}
