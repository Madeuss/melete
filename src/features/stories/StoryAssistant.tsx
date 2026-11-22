import { ListChecks } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { llmErrorMessage, type ErrorMessage } from '../../app/errors'
import { structureStory } from '../../app/services'
import { useSettings } from '../../app/settingsContext'
import type { StructureStoryOutput } from '../../interview/prompts'
import { isAbortError } from '../../providers/llm/errors'
import { Button, Card, Field, Input, Notice, Textarea, iconPropsSm } from '../../ui'

const NARRATIVE_MAX = 4000

/**
 * "Organize with help": the user tells the story however it comes, the model splits it into STAR
 * (filling the editor below) and asks about what's missing; answering refines it.
 */
export function StoryAssistant({ onResult }: { onResult: (r: StructureStoryOutput) => void }) {
  const { t } = useTranslation()
  const { settings } = useSettings()
  const ids = useId()
  const [open, setOpen] = useState(false)
  const [narrative, setNarrative] = useState('')
  const [questions, setQuestions] = useState<string[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  /** Answers from earlier rounds, sent again so later rounds keep them. */
  const [answered, setAnswered] = useState<Array<{ question: string; answer: string }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ErrorMessage>()
  const [done, setDone] = useState(false)
  const abort = useRef<AbortController>(undefined)

  if (!open) {
    return (
      <Card tone="subtle" className="flex flex-col items-start gap-3">
        <h2 className="text-base font-semibold">{t('stories.assistant.title')}</h2>
        <p className="text-sm text-text-muted">{t('stories.assistant.intro')}</p>
        <Button size="sm" icon={<ListChecks {...iconPropsSm} />} onClick={() => setOpen(true)}>
          {t('stories.assistant.open')}
        </Button>
      </Card>
    )
  }

  async function run() {
    if (!settings.llm || !narrative.trim()) return
    abort.current?.abort()
    abort.current = new AbortController()
    setLoading(true)
    setError(undefined)
    const allAnswers = [
      ...answered,
      ...questions.map((q) => ({ question: q, answer: (answers[q] ?? '').trim() })).filter((a) => a.answer),
    ]
    try {
      const result = await structureStory(
        settings.llm,
        { narrative, answers: allAnswers, uiLanguage: settings.uiLanguage },
        abort.current.signal,
      )
      onResult(result)
      setAnswered(allAnswers)
      setQuestions(result.missing)
      setAnswers({})
      setDone(true)
    } catch (err) {
      if (!isAbortError(err)) setError(llmErrorMessage(t, err, settings.llm.preset))
    } finally {
      setLoading(false)
    }
  }

  const answeredSome = questions.some((q) => answers[q]?.trim())

  return (
    <Card tone="subtle" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{t('stories.assistant.title')}</h2>
        <p className="text-sm text-text-muted">{t('stories.assistant.how')}</p>
      </div>

      {!settings.llm ? (
        <Notice
          tone="info"
          title={t('stories.assistant.needsProvider')}
          action={
            <Link to="/settings" className="text-sm font-medium text-brand-text hover:underline">
              {t('newInterview.change')}
            </Link>
          }
        />
      ) : (
        <>
          <Field id={`${ids}-narrative`} label={t('stories.assistant.narrative')} hint={t('stories.assistant.narrativeHint')}>
            <Textarea
              id={`${ids}-narrative`}
              rows={5}
              maxLength={NARRATIVE_MAX}
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              aria-describedby={`${ids}-narrative-hint`}
            />
          </Field>

          {done && questions.length > 0 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-medium">{t('stories.assistant.missingTitle')}</h3>
                <p className="text-sm text-text-muted">{t('stories.assistant.missingHint')}</p>
              </div>
              {questions.map((q, i) => (
                <Field key={q} id={`${ids}-q${i}`} label={q}>
                  <Input
                    id={`${ids}-q${i}`}
                    value={answers[q] ?? ''}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q]: e.target.value }))}
                  />
                </Field>
              ))}
            </div>
          )}

          {done && questions.length === 0 && <Notice tone="success" title={t('stories.assistant.complete')} />}
          {done && <p className="text-sm text-text-muted" aria-live="polite">{t('stories.assistant.review')}</p>}

          {error && (
            <Notice tone="danger" title={error.title}>
              <p>{error.action}</p>
              {error.detail && <p className="mt-1 break-words text-caption">{error.detail}</p>}
            </Notice>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button loading={loading} disabled={!narrative.trim()} onClick={() => void run()}>
              {done && answeredSome ? t('stories.assistant.refine') : t('stories.assistant.organize')}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('common.close')}
            </Button>
          </div>
          <p className="text-caption text-text-subtle">
            {t('stories.assistant.privacy')}
          </p>
        </>
      )}
    </Card>
  )
}
