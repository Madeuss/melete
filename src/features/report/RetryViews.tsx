import { ArrowDown, ArrowUp, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { formatDate, formatNumber } from '../../app/format'
import { useSettings } from '../../app/settingsContext'
import { feedbackAverage, type Session, type Turn } from '../../schemas'
import { Button, Card, cn, iconPropsSm } from '../../ui'
import { compareAnswers, startRetry } from './retry'

/** Starts a new attempt at `turn` (a question of `original`) and opens the interview room. */
export function RetryButton({ original, turn, label }: { original: Session; turn: Turn; label?: string }) {
  const { t } = useTranslation()
  const { settings } = useSettings()
  const navigate = useNavigate()
  const [starting, setStarting] = useState(false)
  if (!settings.llm) return null
  const model = settings.llm.model
  return (
    <Button
      size="sm"
      icon={<RotateCcw {...iconPropsSm} />}
      loading={starting}
      onClick={async () => {
        setStarting(true)
        navigate(`/interview/${await startRetry(original, turn, model)}`)
      }}
    >
      {label ?? t('report.retry.button')}
    </Button>
  )
}

/** Under a question of the original report: the attempts made since, linking to each comparison. */
export function RetryAttempts({ turn, attempts }: { turn: Turn; attempts: Array<{ session: Session; turn?: Turn }> }) {
  const { t, i18n } = useTranslation()
  const n = (x: number) => formatNumber(x, i18n.language)
  const done = attempts.filter((a) => a.turn?.feedback)
  if (!done.length) return null
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-medium">{t('report.retry.attempts', { count: done.length })}</h4>
      <ul className="flex flex-col gap-1 text-sm">
        {done.map(({ session, turn: attempt }) => (
          <li key={session.id}>
            <Link to={`/report/${session.id}`} className="text-brand-text hover:underline">
              {t('report.retry.attemptLine', {
                date: formatDate(session.createdAt, i18n.language, true),
                before: turn.feedback ? n(feedbackAverage(turn.feedback)) : '–',
                after: n(feedbackAverage(attempt!.feedback!)),
              })}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The arrow shows which way the number moved; the color, whether that's better. */
export function Delta({ before, after, lowerIsBetter = false }: { before?: number; after?: number; lowerIsBetter?: boolean }) {
  const { t, i18n } = useTranslation()
  if (before === undefined || after === undefined || before === after) return <span className="text-text-subtle">–</span>
  const up = after > before
  const better = up !== lowerIsBetter
  const diff = formatNumber(Math.abs(after - before), i18n.language)
  return (
    <span className={cn('inline-flex items-center gap-1 font-medium', better ? 'text-success' : 'text-danger')}>
      {up ? <ArrowUp {...iconPropsSm} /> : <ArrowDown {...iconPropsSm} />}
      <span className="sr-only">{t(better ? 'report.compare.better' : 'report.compare.worse', { diff })}</span>
      <span aria-hidden>{diff}</span>
    </span>
  )
}

/** The report of an attempt: the original answer and the new one, side by side. */
export function RetryComparison({ original, before, after }: { original: Session; before: Turn; after: Turn }) {
  const { t, i18n } = useTranslation()
  const n = (x: number | undefined) => (x === undefined ? '–' : formatNumber(x, i18n.language))
  const c = compareAnswers(before, after)
  const label = (key: (typeof c.scores)[number]['key']) =>
    key === 'clarity' ? t('feedback.clarity') : key === 'average' ? t('report.compare.average') : t(`feedback.star.${key}`)

  return (
    <Card tone="subtle" size="panel" className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg">{t('report.compare.title')}</h2>
        <p className="text-sm text-text-muted">
          {t('report.compare.from', { date: formatDate(original.createdAt, i18n.language, true) })}{' '}
          <Link to={`/report/${original.id}`} className="font-medium text-brand-text hover:underline">
            {t('report.compare.openOriginal')}
          </Link>
        </p>
      </div>

      <div className="relative overflow-x-auto">
        <table className="w-full text-left text-sm tabular-nums">
          <thead className="text-text-muted">
            <tr className="border-b border-border">
              <th scope="col" className="py-2 pr-4 font-medium">{t('report.compare.item')}</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">{t('report.compare.before')}</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">{t('report.compare.after')}</th>
              <th scope="col" className="py-2 text-right font-medium">{t('report.compare.change')}</th>
            </tr>
          </thead>
          <tbody>
            {c.scores.map((s) => (
              <tr key={s.key} className={cn('border-b border-border', s.key === 'average' && 'font-semibold')}>
                <th scope="row" className="py-2 pr-4 font-normal">{label(s.key)}</th>
                <td className="py-2 pr-4 text-right">{n(s.before)}</td>
                <td className="py-2 pr-4 text-right">{n(s.after)}</td>
                <td className="py-2 text-right">
                  <Delta before={s.before} after={s.after} />
                </td>
              </tr>
            ))}
            <tr className="border-b border-border">
              <th scope="row" className="py-2 pr-4 font-normal">{t('report.compare.words')}</th>
              <td className="py-2 pr-4 text-right">{n(c.words.before)}</td>
              <td className="py-2 pr-4 text-right">{n(c.words.after)}</td>
              <td className="py-2 text-right text-text-subtle">–</td>
            </tr>
            <tr className="border-b border-border">
              <th scope="row" className="py-2 pr-4 font-normal">{t('report.compare.wpm')}</th>
              <td className="py-2 pr-4 text-right">{n(c.wordsPerMinute.before)}</td>
              <td className="py-2 pr-4 text-right">{n(c.wordsPerMinute.after)}</td>
              <td className="py-2 text-right text-text-subtle">–</td>
            </tr>
            <tr>
              <th scope="row" className="py-2 pr-4 font-normal">{t('feedback.fillers')}</th>
              <td className="py-2 pr-4 text-right">{n(c.fillers.before)}</td>
              <td className="py-2 pr-4 text-right">{n(c.fillers.after)}</td>
              <td className="py-2 text-right">
                <Delta before={c.fillers.before} after={c.fillers.after} lowerIsBetter />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {[
          { title: t('report.compare.before'), turn: before },
          { title: t('report.compare.after'), turn: after },
        ].map(({ title, turn }) => (
          <div key={title} className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{title}</h3>
            <p className="whitespace-pre-wrap text-reading text-text">{turn.transcript}</p>
          </div>
        ))}
      </div>

      <div>
        <RetryButton original={original} turn={before} label={t('report.retry.again')} />
      </div>
    </Card>
  )
}
