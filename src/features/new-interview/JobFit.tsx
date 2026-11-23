import { CircleCheck, CircleDashed, CircleHelp } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { llmErrorMessage, type ErrorMessage } from '../../app/errors'
import { compareProfileJob } from '../../app/services'
import { useSettings } from '../../app/settingsContext'
import type { JobRequirement } from '../../interview/prompts'
import type { Profile } from '../../schemas'
import { Button, Card, Notice, cn, iconPropsSm } from '../../ui'

const icon = { strong: CircleCheck, weak: CircleHelp, none: CircleDashed } as const
const tone = { strong: 'text-success', weak: 'text-warning', none: 'text-danger' } as const

/** On demand: what the job asks for and how well the CV shows it, gaps first, with how to answer. */
export function JobFit({ profile, jobDescription }: { profile: Profile; jobDescription: string }) {
  const { t } = useTranslation()
  const { settings } = useSettings()
  const [result, setResult] = useState<{ for: string; requirements: JobRequirement[] }>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ErrorMessage>()
  if (!settings.llm) return null
  const llm = settings.llm
  // A different job description makes the last comparison stale.
  const current = result?.for === jobDescription ? result.requirements : undefined

  async function run() {
    setLoading(true)
    setError(undefined)
    try {
      const requirements = await compareProfileJob(llm, {
        profile,
        jobDescription,
        feedbackLanguage: settings.uiLanguage,
      })
      setResult({ for: jobDescription, requirements })
    } catch (err) {
      setError(llmErrorMessage(t, err, llm.preset))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card tone="subtle" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{t('jobFit.title')}</h2>
        <p className="text-sm text-text-muted">{t('jobFit.hint')}</p>
      </div>
      {current ? (
        <ul className="flex flex-col gap-3">
          {current.map((r) => {
            const Icon = icon[r.evidence]
            return (
              <li key={r.requirement} className="flex gap-3">
                <Icon {...iconPropsSm} className={cn('mt-0.5 shrink-0', tone[r.evidence])} />
                <div className="flex flex-col gap-0.5 text-sm">
                  <span>
                    <span className="font-medium">{r.requirement}</span>
                    <span className="text-text-muted"> · {t(`jobFit.evidence.${r.evidence}`)}</span>
                  </span>
                  {r.tip && <span className="text-text-muted">{r.tip}</span>}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <div>
          <Button size="sm" loading={loading} onClick={() => void run()}>
            {t('jobFit.button')}
          </Button>
        </div>
      )}
      {error && (
        <Notice tone="danger" title={error.title}>
          {error.action}
        </Notice>
      )}
    </Card>
  )
}
