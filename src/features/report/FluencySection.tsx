import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { llmErrorMessage, type ErrorMessage } from '../../app/errors'
import { formatNumber } from '../../app/format'
import { suggestExpressions } from '../../app/services'
import { useSettings } from '../../app/settingsContext'
import { LONG_PAUSE_MS, REPEATED_MIN, fluencySummary } from '../../interview/fluency'
import type { Session, Turn } from '../../schemas'
import { getRepositories } from '../../storage/repositories'
import { Button, Card, Notice } from '../../ui'

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </div>
  )
}

/** English fluency for non-native speakers: pauses, pronunciation hints, repeated words, better phrasings. */
export function FluencySection({ session, turns }: { session: Session; turns: Turn[] }) {
  const { t, i18n } = useTranslation()
  const { settings } = useSettings()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ErrorMessage>()
  const f = fluencySummary(turns)
  const seconds = (ms: number) => formatNumber(ms / 1000, i18n.language)

  async function suggest() {
    if (!settings.llm) return
    setLoading(true)
    setError(undefined)
    try {
      const expressions = await suggestExpressions(settings.llm, {
        answers: turns.map((x) => x.transcript),
        feedbackLanguage: settings.uiLanguage,
      })
      await getRepositories().sessions.update(session.id, { expressions })
    } catch (err) {
      setError(llmErrorMessage(t, err, settings.llm.preset))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card tone="subtle" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg">{t('fluency.title')}</h2>
        <p className="text-sm text-text-muted">{t('fluency.description')}</p>
      </div>

      <Block title={t('fluency.pauses.title')}>
        <p className="text-sm text-text-muted">
          {f.pauses.answers === 0
            ? t('fluency.pauses.noVoice')
            : f.pauses.count === 0
              ? t('fluency.pauses.none', { seconds: LONG_PAUSE_MS / 1000 })
              : t('fluency.pauses.some', {
                  count: f.pauses.count,
                  seconds: LONG_PAUSE_MS / 1000,
                  longest: seconds(f.pauses.longestMs),
                })}
        </p>
      </Block>

      <Block title={t('fluency.pronunciation.title')}>
        {f.pronunciation.length === 0 ? (
          <p className="text-sm text-text-muted">
            {f.corrected === 0 ? t('fluency.pronunciation.noCorrections') : t('fluency.pronunciation.none')}
          </p>
        ) : (
          <>
            <p className="text-sm text-text-muted">{t('fluency.pronunciation.hint')}</p>
            <ul className="flex flex-col gap-1 text-sm">
              {f.pronunciation.map((p) => (
                <li key={p.word}>
                  <span className="font-medium">{p.word}</span>{' '}
                  <span className="text-text-muted">
                    {t('fluency.pronunciation.heardAs', { count: p.answers, heard: p.heardAs.join(', ') })}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Block>

      <Block title={t('fluency.repeated.title')}>
        {f.repeated.length === 0 ? (
          <p className="text-sm text-text-muted">{t('fluency.repeated.none', { min: REPEATED_MIN })}</p>
        ) : (
          <p className="text-sm">
            {f.repeated.map((r, i) => (
              <span key={r.word}>
                {i > 0 && ', '}
                <span className="font-medium">{r.word}</span> <span className="text-text-muted">×{r.count}</span>
              </span>
            ))}
          </p>
        )}
      </Block>

      <Block title={t('fluency.expressions.title')}>
        {session.expressions ? (
          session.expressions.length === 0 ? (
            <p className="text-sm text-text-muted">{t('fluency.expressions.none')}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {session.expressions.map((e) => (
                <li key={e.said} className="flex flex-col gap-0.5 text-sm">
                  <span>
                    <span className="text-text-muted">{t('fluency.expressions.said')}</span> “{e.said}”
                  </span>
                  <span>
                    <span className="text-text-muted">{t('fluency.expressions.better')}</span>{' '}
                    <span className="font-medium">“{e.better}”</span>
                  </span>
                  <span className="text-text-muted">{e.why}</span>
                </li>
              ))}
            </ul>
          )
        ) : settings.llm ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-text-muted">{t('fluency.expressions.offer')}</p>
            <Button size="sm" loading={loading} onClick={() => void suggest()}>
              {t('fluency.expressions.button')}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-text-muted">{t('fluency.expressions.needsProvider')}</p>
        )}
        {error && (
          <Notice tone="danger" title={error.title}>
            {error.action}
          </Notice>
        )}
      </Block>
    </Card>
  )
}
