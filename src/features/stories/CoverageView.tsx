import { Check, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { Story } from '../../schemas'
import { Notice, buttonClasses, cn, iconPropsSm } from '../../ui'
import { coverage } from './coverage'

/** Stories × competencies: which competencies have a story and which still need one. */
export function CoverageView({ stories }: { stories: Story[] }) {
  const { t } = useTranslation()
  const { counts, missing, rows } = coverage(stories)

  return (
    <div className="flex flex-col gap-8">
      {missing.length > 0 ? (
        <section aria-labelledby="coverage-missing" className="flex flex-col gap-3">
          <h2 id="coverage-missing" className="text-lg">
            {t('stories.coverage.missingTitle', { count: missing.length })}
          </h2>
          <p className="text-sm text-text-muted">{t('stories.coverage.missingHint')}</p>
          <ul className="flex flex-wrap gap-2">
            {missing.map((c) => (
              <li key={c}>
                <Link to={`/stories/new?tag=${encodeURIComponent(c)}`} className={buttonClasses('secondary', 'sm')}>
                  <Plus {...iconPropsSm} />
                  {t(`competencies.${c}`)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <Notice tone="success" title={t('stories.coverage.allCovered')} />
      )}

      <div className="relative overflow-x-auto rounded-card border border-border">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{t('stories.coverage.caption')}</caption>
          <thead>
            <tr className="border-b border-border bg-surface-subtle">
              <th scope="col" className="sticky left-0 z-10 min-w-48 bg-surface-subtle px-4 py-3 text-left font-medium">
                {t('stories.coverage.story')}
              </th>
              {counts.map(({ competency }) => (
                <th
                  key={competency}
                  scope="col"
                  className="min-w-24 px-2 py-3 text-center align-bottom text-caption font-medium text-text-muted"
                >
                  {t(`competencies.${competency}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ story, covers }) => (
              <tr key={story.id} className="border-b border-border">
                <th scope="row" className="sticky left-0 z-10 bg-bg px-4 py-3 text-left font-normal">
                  <Link to={`/stories/${story.id}`} className="hover:underline">
                    {story.title}
                  </Link>
                </th>
                {counts.map(({ competency }) => (
                  <td key={competency} className="px-2 py-3 text-center">
                    {covers.has(competency) ? (
                      <>
                        <Check {...iconPropsSm} className="mx-auto text-brand-text" />
                        <span className="sr-only">{t('stories.coverage.covered')}</span>
                      </>
                    ) : (
                      <>
                        <span aria-hidden className="text-text-subtle">
                          ·
                        </span>
                        <span className="sr-only">{t('stories.coverage.notCovered')}</span>
                      </>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-surface-subtle">
              <th scope="row" className="sticky left-0 z-10 bg-surface-subtle px-4 py-3 text-left font-medium">
                {t('stories.coverage.total')}
              </th>
              {counts.map(({ competency, count }) => (
                <td
                  key={competency}
                  className={cn('px-2 py-3 text-center font-medium tabular-nums', count === 0 && 'text-warning')}
                >
                  {count}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-caption text-text-subtle">{t('stories.coverage.hint')}</p>
    </div>
  )
}
