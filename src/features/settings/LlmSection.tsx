import { Eye, EyeOff, ExternalLink } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { llmErrorMessage, type ErrorMessage } from '../../app/errors'
import { checkConnection, fetchModels } from '../../app/services'
import { useSettings } from '../../app/settingsContext'
import { PRESETS, PRESET_ORDER, getPreset, type PresetId } from '../../providers/llm/presets'
import { LlmSettings } from '../../schemas'
import { Button, Field, Input, Notice, SegmentedControl, buttonClasses, describedBy } from '../../ui'
import { Section } from '../../ui/PageHeader'

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url || '—'
  }
}

type Status =
  | { kind: 'idle' }
  | { kind: 'testing' }
  | { kind: 'ok'; model: string }
  | { kind: 'saved' }
  | { kind: 'error'; message: ErrorMessage }

export function LlmSection() {
  const { t } = useTranslation()
  const { settings, update } = useSettings()
  const ids = useId()
  const saved = settings.llm
  const [preset, setPreset] = useState<PresetId>((saved?.preset as PresetId) ?? 'openai')
  const [baseUrl, setBaseUrl] = useState(saved?.baseUrl ?? PRESETS.openai.baseUrl)
  const [apiKey, setApiKey] = useState(saved?.apiKey ?? '')
  const [model, setModel] = useState(saved?.model ?? PRESETS.openai.defaultModel)
  const [showKey, setShowKey] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [models, setModels] = useState<string[]>()
  const [loadingModels, setLoadingModels] = useState(false)
  const [errors, setErrors] = useState<{ baseUrl?: string; model?: string; apiKey?: string }>({})
  const abort = useRef<AbortController | null>(null)

  useEffect(() => () => abort.current?.abort(), [])

  const info = getPreset(preset)
  const origin = window.location.origin
  const localHint =
    preset === 'ollama'
      ? t('errors.localHint.ollama', { origin })
      : preset === 'lmstudio'
        ? t('errors.localHint.lmstudio')
        : undefined

  function choosePreset(id: PresetId) {
    const p = PRESETS[id]
    setPreset(id)
    // Keep what the user typed for "custom"; otherwise fill in the preset defaults.
    if (id !== 'custom') {
      setBaseUrl(p.baseUrl)
      setModel(saved?.preset === id ? saved.model : p.defaultModel)
      setApiKey(saved?.preset === id ? saved.apiKey : '')
    }
    setModels(undefined)
    setErrors({})
    setStatus({ kind: 'idle' })
  }

  function current(): LlmSettings | undefined {
    const next = { preset, baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), model: model.trim() }
    const result = LlmSettings.safeParse(next)
    const errs: typeof errors = {}
    if (!result.success) {
      for (const issue of result.error.issues) {
        if (issue.path[0] === 'baseUrl') errs.baseUrl = t('settings.llm.invalidUrl')
        if (issue.path[0] === 'model') errs.model = t('settings.llm.modelRequired')
      }
    }
    if (info.requiresKey && !next.apiKey) errs.apiKey = t('settings.llm.keyRequired')
    setErrors(errs)
    return Object.keys(errs).length === 0 && result.success ? result.data : undefined
  }

  async function onTest() {
    const llm = current()
    if (!llm) return
    abort.current?.abort()
    abort.current = new AbortController()
    setStatus({ kind: 'testing' })
    try {
      await checkConnection(llm, abort.current.signal)
      setStatus({ kind: 'ok', model: llm.model })
    } catch (err) {
      setStatus({ kind: 'error', message: llmErrorMessage(t, err, preset) })
    }
  }

  async function onLoadModels() {
    const llm = { preset, baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), model: model.trim() || 'x' }
    if (!LlmSettings.safeParse(llm).success) return current()
    setLoadingModels(true)
    try {
      setModels(await fetchModels(llm))
      setStatus({ kind: 'idle' })
    } catch (err) {
      setModels([])
      setStatus({ kind: 'error', message: llmErrorMessage(t, err, preset) })
    } finally {
      setLoadingModels(false)
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault()
    const llm = current()
    if (!llm) return
    await update({ llm })
    setStatus({ kind: 'saved' })
  }

  return (
    <Section id={`${ids}-title`} title={t('settings.llm.title')}>
      <form onSubmit={onSave} noValidate className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span id={`${ids}-preset`} className="text-sm font-medium">
            {t('settings.llm.provider')}
          </span>
          <SegmentedControl
            variant="chips"
            aria-labelledby={`${ids}-preset`}
            value={preset}
            onChange={choosePreset}
            options={PRESET_ORDER.map((id) => ({
              value: id,
              label: id === 'custom' ? t('settings.llm.customLabel') : PRESETS[id].name,
            }))}
          />
        </div>

        {info.local && (
          <Notice tone="info" title={t('settings.llm.localNotice', { name: info.name })}>
            {localHint && t('settings.llm.corsNotice', { hint: localHint })}
          </Notice>
        )}

        <Field
          id={`${ids}-url`}
          label={t('settings.llm.baseUrl')}
          hint={t('settings.llm.baseUrlHint')}
          error={errors.baseUrl}
        >
          <Input
            id={`${ids}-url`}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            aria-invalid={!!errors.baseUrl || undefined}
            aria-describedby={describedBy(`${ids}-url`, { hint: true, error: errors.baseUrl })}
          />
        </Field>

        <Field
          id={`${ids}-key`}
          label={info.requiresKey ? t('settings.llm.apiKey') : t('settings.llm.apiKeyNotNeeded')}
          hint={t('settings.llm.apiKeyHint', { name: info.id === 'custom' ? hostOf(baseUrl) : info.name })}
          error={errors.apiKey}
          aside={
            info.keyUrl && (
              <a
                href={info.keyUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-brand-text hover:underline"
              >
                {t('settings.llm.getKey')}
                <ExternalLink size={14} strokeWidth={1.5} aria-hidden />
              </a>
            )
          }
        >
          <div className="relative">
            <Input
              id={`${ids}-key`}
              type={showKey ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="pr-14"
              aria-invalid={!!errors.apiKey || undefined}
              aria-describedby={describedBy(`${ids}-key`, { hint: true, error: errors.apiKey })}
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              aria-label={showKey ? t('common.hide') : t('common.show')}
              aria-pressed={showKey}
              className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-pill text-text-muted hover:bg-border hover:text-text"
            >
              {showKey ? <EyeOff size={18} strokeWidth={1.5} aria-hidden /> : <Eye size={18} strokeWidth={1.5} aria-hidden />}
            </button>
          </div>
        </Field>

        <Field
          id={`${ids}-model`}
          label={t('settings.llm.model')}
          hint={
            models
              ? models.length
                ? t('settings.llm.modelsLoaded', { count: models.length })
                : t('settings.llm.noModels')
              : t('settings.llm.modelHint')
          }
          error={errors.model}
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              id={`${ids}-model`}
              list={`${ids}-models`}
              autoComplete="off"
              spellCheck={false}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              aria-invalid={!!errors.model || undefined}
              aria-describedby={describedBy(`${ids}-model`, { hint: true, error: errors.model })}
            />
            <datalist id={`${ids}-models`}>
              {models?.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <Button onClick={onLoadModels} loading={loadingModels} className="shrink-0">
              {t('settings.llm.loadModels')}
            </Button>
          </div>
        </Field>

        <div aria-live="polite" className="empty:hidden">
          {status.kind === 'ok' && (
            <Notice tone="success" title={t('settings.llm.testOk')}>
              {t('settings.llm.testOkDetail', { model: status.model })}
            </Notice>
          )}
          {status.kind === 'saved' && (
            <Notice
              tone="success"
              title={t('settings.llm.saveDone')}
              action={
                <Link to="/new" className={buttonClasses('secondary', 'sm')}>
                  {t('settings.llm.startInterview')}
                </Link>
              }
            />
          )}
          {status.kind === 'error' && (
            <Notice tone="danger" title={status.message.title}>
              {status.message.action && <p>{status.message.action}</p>}
              {status.message.detail && <p className="mt-1 break-words text-caption">{status.message.detail}</p>}
            </Notice>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="primary">
            {t('common.save')}
          </Button>
          <Button onClick={onTest} loading={status.kind === 'testing'}>
            {t('settings.llm.test')}
          </Button>
        </div>
      </form>
    </Section>
  )
}
