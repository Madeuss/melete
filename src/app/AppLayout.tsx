import { BookOpen, History, Mic, Settings as SettingsIcon, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router'
import { Logo, cn } from '../ui'

interface Item {
  to: string
  label: string
  icon: LucideIcon
}

function NavItem({ to, label, icon: Icon }: Item) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex h-11 shrink-0 items-center gap-3 rounded-pill px-4 text-sm font-medium transition-colors duration-150 ease-out',
          isActive ? 'bg-brand-soft text-brand-soft-text' : 'text-text-muted hover:bg-surface-sunken hover:text-text',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={20} strokeWidth={1.5} aria-hidden className={isActive ? 'text-brand' : undefined} />
          {label}
        </>
      )}
    </NavLink>
  )
}

/** Sidebar on desktop, top bar on small screens. The interview room doesn't use this layout. */
export function AppLayout() {
  const { t } = useTranslation()
  const main: Item[] = [
    { to: '/new', label: t('nav.newInterview'), icon: Mic },
    { to: '/history', label: t('nav.history'), icon: History },
    { to: '/stories', label: t('nav.stories'), icon: BookOpen },
  ]
  const settings: Item = { to: '/settings', label: t('nav.settings'), icon: SettingsIcon }

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[248px_1fr]">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('main')?.focus()
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-pill focus:bg-bg focus:px-4 focus:py-2"
      >
        {t('app.skipToContent')}
      </a>
      <aside className="border-b border-border bg-surface-subtle md:border-b-0">
        <div className="md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:p-4">
        <div className="flex h-16 items-center px-4 md:mb-6 md:h-auto md:px-4 md:pt-3">
          <Logo />
        </div>
        <nav
          aria-label={t('nav.label')}
          className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-visible md:px-0 md:pb-0"
        >
          {main.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
          <div className="md:mt-auto">
            <NavItem {...settings} />
          </div>
        </nav>
        </div>
      </aside>
      <main id="main" tabIndex={-1} className="min-w-0 outline-none">
        <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 md:py-12">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
