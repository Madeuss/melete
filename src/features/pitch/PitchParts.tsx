import { useTranslation } from 'react-i18next'
import {
  PITCH_SCORE_KEYS,
  PITCH_TARGET_SECONDS,
  formatClock,
  pitchSeconds,
  pitchTiming,
  type PitchTiming,
} from '../../interview/pitch'
import type { Pitch, PitchFeedback } from '../../schemas'
import { cn } from '../../ui'
import { ScoreRow } from '../report/FeedbackView'

/** The bar runs to 2 minutes, with the 60–90 s target band marked. */
const SCALE_SECONDS = 120

const timingTone: Record<PitchTiming, string> = {
  short: 'text-warning',
  onTarget: 'text-success',
  long: 'text-warning',
}

/** Elapsed time against the 60–90 second target, live while recording or for a saved version. */
export function PitchTimer({ seconds, estimated = false, live = false }: { seconds: number; estimated?: boolean; live?: boolean }) {
  const { t } = useTranslation()
  const timing = pitchTiming(seconds)
  const pct = (x: number) => `${Math.min(100, (x / SCALE_SECONDS) * 100)}%`
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-2xl font-semibold tabular-nums" aria-live={live ? 'off' : undefined}>
          {estimated && '~'}
          {formatClock(seconds)}
        </span>
        <span className={cn('text-sm font-medium', live && timing === 'short' ? 'text-text-muted' : timingTone[timing])}>
          {t(`pitch.timing.${timing}`, PITCH_TARGET_SECONDS)}
        </span>
      </div>
      <div className="relative h-2 w-full rounded-pill bg-surface-sunken" aria-hidden>
        <span
          className="absolute inset-y-0 rounded-pill bg-success/25"
          style={{ left: pct(PITCH_TARGET_SECONDS.min), width: pct(PITCH_TARGET_SECONDS.max - PITCH_TARGET_SECONDS.min) }}
        />
        <span className="absolute inset-y-0 left-0 rounded-pill bg-brand" style={{ width: pct(seconds) }} />
      </div>
      {estimated && <p className="text-caption text-text-subtle">{t('pitch.estimated')}</p>}
    </div>
  )
}

/** Scores, what worked, what to improve and a tighter version, for one saved version. */
export function PitchFeedbackView({ pitch, feedback }: { pitch: Pitch; feedback: PitchFeedback }) {
  const { t } = useTranslation()
  const { seconds, estimated } = pitchSeconds(pitch)
  return (
    <div className="flex flex-col gap-6">
      <PitchTimer seconds={seconds} estimated={estimated} />
      <div className="flex flex-col gap-3">
        {PITCH_SCORE_KEYS.map((k) => (
          <ScoreRow key={k} label={t(`pitch.scores.${k}`)} score={feedback.scores[k]} />
        ))}
      </div>
      {[
        { title: t('feedback.strengths'), items: feedback.strengths },
        { title: t('feedback.improvements'), items: feedback.improvements },
      ].map(
        ({ title, items }) =>
          items.length > 0 && (
            <div key={title} className="flex flex-col gap-2">
              <h4 className="text-sm font-medium">{title}</h4>
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-base text-text-muted marker:text-text-subtle">
                {items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ),
      )}
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium">{t('pitch.improvedVersion')}</h4>
        <p className="whitespace-pre-wrap rounded-field bg-surface-subtle p-5 text-reading">{feedback.improvedVersion}</p>
      </div>
    </div>
  )
}
