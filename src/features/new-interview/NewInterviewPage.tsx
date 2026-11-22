import { useEffect, useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { preloadVoice } from '../../app/services'
import { useSettings } from '../../app/settingsContext'
import { InterviewType, Seniority, SessionConfig, type FeedbackTiming } from '../../schemas'
import { useStories } from '../../storage/hooks'
import { getRepositories } from '../../storage/repositories'
import { Button, Field, Input, SegmentedControl, Select, Textarea, Toggle, describedBy } from '../../ui'
import { PageHeader } from '../../ui/PageHeader'

const LAST_CONFIG_KEY = 'melete.lastConfig'

const defaults: SessionConfig = {
  type: 'behavioral',
  role: '',
  seniority: 'mid',
  jobDescription: '',
  questionCount: 5,
  followUps: true,
  feedbackTiming: 'per-answer',
}

/** The last config is remembered in this browser as a convenience; losing it is harmless. */
function loadLastConfig(): SessionConfig {
  try {
    const parsed = SessionConfig.partial().safeParse(JSON.parse(localStorage.getItem(LAST_CONFIG_KEY) ?? '{}'))
    return parsed.success ? { ...defaults, ...parsed.data } : defaults
  } catch {
    return defaults
  }
}

function saveLastConfig(config: SessionConfig) {
  try {
    localStorage.setItem(LAST_CONFIG_KEY, JSON.stringify(config))
  } catch {
    // ignore
  }
}

export default function NewInterviewPage() {
  const { t } = useTranslation()
  const ids = useId()
  const navigate = useNavigate()
  const { settings } = useSettings()
  const stories = useStories()
  const [config, setConfig] = useState<SessionConfig>(loadLastConfig)
  const [roleError, setRoleError] = useState(false)
  const [starting, setStarting] = useState(false)

  // Warm up the voice model while the form is filled in, so the first question isn't delayed.
  useEffect(() => preloadVoice(settings), [settings])

  const set = <K extends keyof SessionConfig>(key: K, value: SessionConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = SessionConfig.safeParse({
      ...config,
      role: config.role.trim(),
      jobDescription: config.jobDescription?.trim() || undefined,
    })
    if (!parsed.success) {
      setRoleError(true)
      document.getElementById(`${ids}-role`)?.focus()
      return
    }
    if (!settings.llm) return
    setStarting(true)
    saveLastConfig(parsed.data)
    const session = await getRepositories().sessions.create({
      config: parsed.data,
      model: settings.llm.model,
      language: settings.interviewLanguage,
      status: 'in-progress',
      plannedQuestions: [],
    })
    navigate(`/interview/${session.id}`)
  }

  const storyCount = stories?.length ?? 0

  return (
    <>
      <PageHeader title={t('newInterview.title')} description={t('newInterview.description')} />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <span id={`${ids}-type`} className="text-sm font-medium">
            {t('newInterview.type')}
          </span>
          <SegmentedControl
            aria-labelledby={`${ids}-type`}
            value={config.type}
            onChange={(v) => set('type', v)}
            options={InterviewType.options.map((v) => ({ value: v, label: t(`newInterview.types.${v}`) }))}
          />
        </div>

        <Field id={`${ids}-role`} label={t('newInterview.role')} error={roleError ? t('newInterview.roleRequired') : undefined}>
          <Input
            id={`${ids}-role`}
            value={config.role}
            placeholder={t('newInterview.rolePlaceholder')}
            onChange={(e) => {
              set('role', e.target.value)
              if (e.target.value.trim()) setRoleError(false)
            }}
            aria-invalid={roleError || undefined}
            aria-describedby={describedBy(`${ids}-role`, { error: roleError })}
          />
        </Field>

        <div className="flex flex-col gap-2">
          <span id={`${ids}-sen`} className="text-sm font-medium">
            {t('newInterview.seniority')}
          </span>
          <SegmentedControl
            aria-labelledby={`${ids}-sen`}
            value={config.seniority}
            onChange={(v) => set('seniority', v)}
            options={Seniority.options.map((v) => ({ value: v, label: t(`newInterview.seniorities.${v}`) }))}
          />
        </div>

        <Field
          id={`${ids}-jd`}
          label={`${t('newInterview.jobDescription')} (${t('common.optional')})`}
          hint={t('newInterview.jobDescriptionHint')}
        >
          <Textarea
            id={`${ids}-jd`}
            rows={4}
            value={config.jobDescription ?? ''}
            onChange={(e) => set('jobDescription', e.target.value)}
            aria-describedby={`${ids}-jd-hint`}
          />
        </Field>

        <div className="grid gap-8 sm:grid-cols-[10rem_1fr]">
          <Field id={`${ids}-count`} label={t('newInterview.questionCount')}>
            <Select
              id={`${ids}-count`}
              value={config.questionCount}
              onChange={(e) => set('questionCount', Number(e.target.value))}
            >
              {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex flex-col gap-2">
            <span id={`${ids}-timing`} className="text-sm font-medium">
              {t('newInterview.feedbackTiming')}
            </span>
            <SegmentedControl<FeedbackTiming>
              aria-labelledby={`${ids}-timing`}
              value={config.feedbackTiming}
              onChange={(v) => set('feedbackTiming', v)}
              options={(['per-answer', 'end'] as const).map((v) => ({ value: v, label: t(`newInterview.timing.${v}`) }))}
            />
          </div>
        </div>

        <Toggle
          checked={config.followUps}
          onChange={(v) => set('followUps', v)}
          label={t('newInterview.followUps')}
          description={t('newInterview.followUpsHint')}
        />

        <div className="flex flex-col gap-1 rounded-card bg-surface-subtle px-5 py-4 text-sm text-text-muted">
          <p>
            {storyCount > 0 ? t('newInterview.storiesUsed', { count: storyCount }) : t('newInterview.noStories')}{' '}
            <Link to="/stories" className="font-medium text-brand-text hover:underline">
              {t('newInterview.addStories')}
            </Link>
          </p>
          <p>
            {t('newInterview.usingModel', {
              model: settings.llm?.model,
              language: t(`newInterview.languages.${settings.interviewLanguage}`),
            })}{' '}
            <Link to="/settings" className="font-medium text-brand-text hover:underline">
              {t('newInterview.change')}
            </Link>
          </p>
        </div>

        <div className="border-t border-border pt-8">
          <Button type="submit" variant="primary" loading={starting}>
            {t('newInterview.start')}
          </Button>
        </div>
      </form>
    </>
  )
}
