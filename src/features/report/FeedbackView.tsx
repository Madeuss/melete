import { CircleCheck, CircleX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { totalFillers } from '../../interview/metrics'
import type { Feedback, Turn } from '../../schemas'
import { cn, iconPropsSm } from '../../ui'

/** 0–5 score as five segments plus the number. Brand pink is used for the filled part (charts). */
export function ScoreRow({ label, score }: { label: string; score: number }) {
  const { t } = useTranslation()
  return (
    <div className="grid grid-cols-[7rem_1fr_auto] items-center gap-4">
      <span className="text-sm text-text-muted">{label}</span>
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={cn('h-2 flex-1 rounded-pill', i <= score ? 'bg-brand' : 'bg-surface-sunken')} />
        ))}
      </div>
      <span className="w-14 text-right text-sm font-medium">
        <span className="sr-only">{t('feedback.scoreOf', { score })}</span>
        <span aria-hidden>{score}/5</span>
      </span>
    </div>
  )
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-medium">{title}</h4>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-base text-text-muted marker:text-text-subtle">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

export function MetricsLine({ turn }: { turn: Turn }) {
  const { t } = useTranslation()
  const fillers = Object.entries(turn.metrics.fillerWords).sort((a, b) => b[1] - a[1])
  const total = totalFillers(turn.metrics.fillerWords)
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-medium">{t('feedback.metrics')}</h4>
      <p className="text-sm text-text-muted">
        {t('feedback.words', { count: turn.metrics.wordCount })}
        {' · '}
        {turn.metrics.wordsPerMinute !== undefined
          ? t('feedback.wpm', { wpm: turn.metrics.wordsPerMinute })
          : t('feedback.typed')}
        {' · '}
        {total === 0
          ? t('feedback.noFillers')
          : `${t('feedback.fillers')}: ${fillers.map(([w, n]) => `${w} ×${n}`).join(', ')}`}
      </p>
    </div>
  )
}

/** Feedback for one answer: scores, answered or not, strengths, improvements, a better version, metrics. */
export function FeedbackView({ turn, feedback, showAnswer = false }: { turn: Turn; feedback?: Feedback; showAnswer?: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-6">
      {showAnswer && (
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-medium">{t('feedback.yourAnswer')}</h4>
          <p className="whitespace-pre-wrap text-reading text-text">{turn.transcript}</p>
        </div>
      )}

      {feedback ? (
        <>
          <div className="flex flex-col gap-3">
            {(['situation', 'task', 'action', 'result'] as const).map((k) => (
              <ScoreRow key={k} label={t(`feedback.star.${k}`)} score={feedback.star[k]} />
            ))}
            <ScoreRow label={t('feedback.clarity')} score={feedback.clarity} />
          </div>

          <p className="flex items-center gap-2 text-sm">
            {feedback.answeredTheQuestion ? (
              <CircleCheck {...iconPropsSm} className="text-success" />
            ) : (
              <CircleX {...iconPropsSm} className="text-danger" />
            )}
            {feedback.answeredTheQuestion ? t('feedback.answered') : t('feedback.notAnswered')}
          </p>

          <div className="grid gap-6 sm:grid-cols-2">
            <List title={t('feedback.strengths')} items={feedback.strengths} />
            <List title={t('feedback.improvements')} items={feedback.improvements} />
          </div>

          <div className="flex flex-col gap-2 rounded-card bg-surface-subtle p-5">
            <h4 className="text-sm font-medium">{t('feedback.improvedAnswer')}</h4>
            <p className="text-caption text-text-subtle">{t('feedback.improvedAnswerHint')}</p>
            <p className="mt-1 whitespace-pre-wrap text-reading">{feedback.improvedAnswer}</p>
          </div>
        </>
      ) : (
        <p className="text-sm text-text-subtle">{t('feedback.pending')}</p>
      )}

      <MetricsLine turn={turn} />
    </div>
  )
}
