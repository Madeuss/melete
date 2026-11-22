import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './cn'
import { iconProps } from './icon'

type Tone = 'info' | 'success' | 'warning' | 'danger'

const icons = { info: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleAlert }
const iconColor: Record<Tone, string> = {
  info: 'text-text-muted',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
}

/** Inline message. Status is always icon + text, never color alone. */
export function Notice({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: Tone
  title?: ReactNode
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  const Icon = icons[tone]
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-card bg-surface-subtle px-5 py-4', className)}
    >
      <Icon {...iconProps} className={cn('mt-0.5 shrink-0', iconColor[tone])} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
        {title && <p className="font-medium text-text">{title}</p>}
        {children && <div className="text-text-muted">{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  )
}
