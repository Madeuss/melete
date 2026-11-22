import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { formatDate, formatNumber } from '../../app/format'
import { useHistory } from '../../storage/hooks'
import { Card, Chip, buttonClasses, iconPropsSm } from '../../ui'
import { PageHeader } from '../../ui/PageHeader'

export default function HistoryPage() {
  const { t, i18n } = useTranslation()
  const rows = useHistory()

  return (
    <>
      <PageHeader title={t('history.title')} description={t('history.description')} />

      {rows && rows.length === 0 && (
        <Card tone="subtle" size="panel" className="flex flex-col items-start gap-4">
          <h2 className="text-lg">{t('history.emptyTitle')}</h2>
          <p className="text-text-muted">{t('history.emptyBody')}</p>
          <Link to="/new" className={buttonClasses('primary')}>
            {t('history.start')}
          </Link>
        </Card>
      )}

      {rows && rows.length > 0 && (
        <ul className="flex flex-col gap-3">
          {rows.map(({ session, answers, average }) => {
            const to = session.status === 'in-progress' ? `/interview/${session.id}` : `/report/${session.id}`
            return (
              <li key={session.id}>
                <Link
                  to={to}
                  className="flex items-center gap-4 rounded-card border border-border bg-bg p-5 transition-colors duration-150 ease-out hover:border-border-strong hover:bg-surface-subtle sm:p-6"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold">{t(`newInterview.types.${session.config.type}`)}</h2>
                      {session.status !== 'finished' && <Chip>{t(`history.status.${session.status}`)}</Chip>}
                    </div>
                    <p className="truncate text-sm text-text-muted">
                      {session.config.role} · {t(`newInterview.seniorities.${session.config.seniority}`)} ·{' '}
                      {t('history.answers', { count: answers })}
                    </p>
                    <p className="text-caption text-text-subtle">{formatDate(session.createdAt, i18n.language, true)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    {average !== undefined ? (
                      <>
                        <span className="text-xl font-semibold">
                          {formatNumber(average, i18n.language)}
                          <span className="text-sm font-normal text-text-subtle">/5</span>
                        </span>
                        <span className="sr-only">{t('history.average', { avg: formatNumber(average, i18n.language) })}</span>
                      </>
                    ) : (
                      <span className="text-sm text-text-subtle">{t('history.noScore')}</span>
                    )}
                  </div>
                  <ChevronRight {...iconPropsSm} className="shrink-0 text-text-subtle" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
