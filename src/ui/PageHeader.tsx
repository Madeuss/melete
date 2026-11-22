import type { ReactNode } from 'react'

/** Page title (32/600), optional description and actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl">{title}</h1>
        {description && <p className="max-w-prose text-base text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
    </header>
  )
}

/** Section inside a page: 20px title, generous spacing. */
export function Section({
  title,
  description,
  children,
  id,
}: {
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  id?: string
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-lg">
          {title}
        </h2>
        {description && <p className="text-sm text-text-muted">{description}</p>}
      </div>
      {children}
    </section>
  )
}
