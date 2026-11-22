import { CircleCheck, Download, Volume2 } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isKokoroSupported, kokoro, ttsFromSettings } from '../../app/services'
import { useSettings } from '../../app/settingsContext'
import { useKokoroStatus } from '../../app/useKokoroStatus'
import { SAMPLE_QUESTION } from '../../interview/samples'
import { isWebSpeechSupported } from '../../providers/stt/webSpeech'
import { isBrowserTtsSupported, loadVoices, voicesFor } from '../../providers/tts/browserTts'
import { KOKORO_VOICES, kokoroVoiceOrDefault } from '../../providers/tts/kokoro/voices'
import type { Settings } from '../../schemas'
import { Button, Field, Notice, Progress, SegmentedControl, Select, iconProps, iconPropsSm } from '../../ui'
import { Section } from '../../ui/PageHeader'

const RATES = [0.8, 0.9, 1, 1.1, 1.25] as const

type TtsKind = Settings['tts']['kind']

export function VoiceSection() {
  const { t } = useTranslation()
  const { settings, update } = useSettings()
  const ids = useId()
  const sttSupported = isWebSpeechSupported()
  const kind = settings.tts.kind

  const engines: Array<{ value: TtsKind; label: string }> = [
    { value: 'off', label: t('settings.voice.engineOff') },
    ...(isBrowserTtsSupported() ? [{ value: 'browser' as const, label: t('settings.voice.engineBrowser') }] : []),
    ...(isKokoroSupported() ? [{ value: 'kokoro' as const, label: t('settings.voice.engineKokoro') }] : []),
  ]

  function chooseEngine(next: TtsKind) {
    // A saved voice belongs to one engine: browser voices are names, Kokoro voices are ids.
    void update((s) => ({ ...s, tts: { ...s.tts, kind: next, voice: undefined } }))
  }

  return (
    <Section id={`${ids}-title`} title={t('settings.voice.title')}>
      <div className="flex flex-col gap-2">
        <span id={`${ids}-mode`} className="text-sm font-medium">
          {t('settings.voice.answerMode')}
        </span>
        <SegmentedControl
          aria-labelledby={`${ids}-mode`}
          value={settings.stt.kind}
          onChange={(stt) => void update({ stt: { kind: stt } })}
          options={[
            { value: 'web-speech', label: t('settings.voice.speak') },
            { value: 'typed-only', label: t('settings.voice.typeOnly') },
          ]}
        />
      </div>

      {settings.stt.kind === 'web-speech' &&
        (sttSupported ? (
          <Notice tone="warning" title={t('settings.voice.googleWarningTitle')}>
            {t('settings.voice.googleWarning')}
          </Notice>
        ) : (
          <Notice tone="info" title={t('settings.voice.unsupportedTitle')}>
            {t('settings.voice.unsupported')}
          </Notice>
        ))}

      {engines.length > 1 && (
        <div className="flex flex-col gap-2">
          <span id={`${ids}-tts`} className="text-sm font-medium">
            {t('settings.voice.readAloud')}
          </span>
          <SegmentedControl aria-labelledby={`${ids}-tts`} value={kind} onChange={chooseEngine} options={engines} />
          {kind === 'browser' && <p className="text-caption text-text-subtle">{t('settings.voice.readAloudHint')}</p>}
        </div>
      )}

      {kind === 'browser' && <BrowserVoiceFields />}
      {kind === 'kokoro' && <KokoroFields />}
    </Section>
  )
}

function RateAndPreview() {
  const { t } = useTranslation()
  const { settings, update } = useSettings()
  const ids = useId()
  return (
    <>
      <Field id={`${ids}-rate`} label={t('settings.voice.rate')}>
        <Select
          id={`${ids}-rate`}
          value={String(settings.tts.rate)}
          onChange={(e) => {
            const rate = Number(e.target.value)
            void update((s) => ({ ...s, tts: { ...s.tts, rate } }))
          }}
        >
          {RATES.map((r) => (
            <option key={r} value={r}>
              {r}×
            </option>
          ))}
        </Select>
      </Field>
      <div>
        <Button
          icon={<Volume2 {...iconPropsSm} />}
          onClick={() => void ttsFromSettings(settings).speak(SAMPLE_QUESTION[settings.interviewLanguage])}
        >
          {t('settings.voice.preview')}
        </Button>
      </div>
    </>
  )
}

function BrowserVoiceFields() {
  const { t } = useTranslation()
  const { settings, update } = useSettings()
  const ids = useId()
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    let alive = true
    void loadVoices().then((v) => alive && setVoices(v))
    return () => {
      alive = false
    }
  }, [])

  const langVoices = voicesFor(voices, settings.interviewLanguage)

  return (
    <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
      <Field
        id={`${ids}-voice`}
        label={t('settings.voice.voice')}
        hint={voices.length > 0 && langVoices.length === 0 ? t('settings.voice.noVoices') : undefined}
      >
        <Select
          id={`${ids}-voice`}
          value={settings.tts.voice ?? ''}
          onChange={(e) => {
            // Read now: the updater runs later, after React has reset the controlled select.
            const voice = e.target.value || undefined
            void update((s) => ({ ...s, tts: { ...s.tts, voice } }))
          }}
        >
          <option value="">{t('settings.voice.defaultVoice')}</option>
          {langVoices.map((v) => (
            <option key={v.voiceURI} value={v.name}>
              {v.name} ({v.lang})
            </option>
          ))}
        </Select>
      </Field>
      <RateAndPreview />
    </div>
  )
}

function KokoroFields() {
  const { t } = useTranslation()
  const { settings, update } = useSettings()
  const ids = useId()
  const status = useKokoroStatus()

  // Coming back to Settings with Kokoro already chosen: load it (from cache) to show its status.
  // Already downloaded: load it from the cache to show it's ready. Otherwise show the download button.
  useEffect(() => {
    kokoro.loadIfDownloaded().catch(() => {}) // the status line shows why
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <Notice tone="info" title={t('settings.voice.kokoroTitle')}>
        {t('settings.voice.kokoroInfo')}
        {settings.interviewLanguage !== 'en' && <> {t('settings.voice.kokoroEnglishOnly')}</>}
      </Notice>

      <KokoroStatusLine />

      {status.state === 'ready' && (
        <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
          <Field id={`${ids}-voice`} label={t('settings.voice.voice')}>
            <Select
              id={`${ids}-voice`}
              value={kokoroVoiceOrDefault(settings.tts.voice)}
              onChange={(e) => {
                const voice = e.target.value
                void update((s) => ({ ...s, tts: { ...s.tts, voice } }))
              }}
            >
              {(['us', 'gb'] as const).map((accent) => (
                <optgroup key={accent} label={t(accent === 'us' ? 'settings.voice.accentUs' : 'settings.voice.accentGb')}>
                  {KOKORO_VOICES.filter((v) => v.accent === accent).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({t(v.gender === 'female' ? 'settings.voice.female' : 'settings.voice.male')})
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
          <RateAndPreview />
        </div>
      )}
    </div>
  )
}

function KokoroStatusLine() {
  const { t } = useTranslation()
  const status = useKokoroStatus()

  if (status.state === 'loading') {
    const percent = status.progress === undefined ? undefined : Math.round(status.progress * 100)
    const label =
      percent === undefined
        ? t('settings.voice.kokoroPreparing')
        : t('settings.voice.kokoroDownloading', { percent })
    return (
      <div className="flex flex-col gap-2" aria-live="polite">
        <p className="text-sm text-text-muted">{label}</p>
        {percent !== undefined && <Progress value={percent} max={100} label={label} />}
      </div>
    )
  }
  if (status.state === 'ready') {
    return (
      <p className="flex items-center gap-2 text-sm text-text-muted" aria-live="polite">
        <CircleCheck {...iconProps} className="text-success" />
        {t('settings.voice.kokoroReady')}
      </p>
    )
  }
  if (status.state === 'error') {
    return (
      <Notice tone="danger" title={t('settings.voice.kokoroErrorTitle')}>
        <p>{t('settings.voice.kokoroError', { message: status.message })}</p>
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => void kokoro.load().catch(() => {})}>
          {t('common.tryAgain')}
        </Button>
      </Notice>
    )
  }
  // Not downloaded (or still checking): downloading is the user's call.
  return (
    <div className="flex flex-col items-start gap-3">
      <Button
        variant="primary"
        icon={<Download {...iconPropsSm} />}
        disabled={status.state === 'idle'}
        onClick={() => void kokoro.load().catch(() => {})}
      >
        {t('settings.voice.kokoroDownload')}
      </Button>
      <p className="text-caption text-text-subtle">{t('settings.voice.kokoroNotDownloaded')}</p>
    </div>
  )
}
