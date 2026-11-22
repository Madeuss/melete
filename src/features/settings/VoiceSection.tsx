import { Volume2 } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ttsFromSettings } from '../../app/services'
import { useSettings } from '../../app/settingsContext'
import { SAMPLE_QUESTION } from '../../interview/samples'
import { isWebSpeechSupported } from '../../providers/stt/webSpeech'
import { isBrowserTtsSupported, loadVoices, voicesFor } from '../../providers/tts/browserTts'
import { Button, Field, Notice, SegmentedControl, Select, Toggle, iconPropsSm } from '../../ui'
import { Section } from '../../ui/PageHeader'

const RATES = [0.8, 0.9, 1, 1.1, 1.25] as const

export function VoiceSection() {
  const { t } = useTranslation()
  const { settings, update } = useSettings()
  const ids = useId()
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const sttSupported = isWebSpeechSupported()
  const ttsSupported = isBrowserTtsSupported()

  useEffect(() => {
    let alive = true
    void loadVoices().then((v) => alive && setVoices(v))
    return () => {
      alive = false
    }
  }, [])

  const langVoices = voicesFor(voices, settings.interviewLanguage)

  return (
    <Section id={`${ids}-title`} title={t('settings.voice.title')}>
      <div className="flex flex-col gap-2">
        <span id={`${ids}-mode`} className="text-sm font-medium">
          {t('settings.voice.answerMode')}
        </span>
        <SegmentedControl
          aria-labelledby={`${ids}-mode`}
          value={settings.stt.kind}
          onChange={(kind) => void update({ stt: { kind } })}
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

      {ttsSupported && (
        <>
          <Toggle
            checked={settings.tts.kind === 'browser'}
            onChange={(on) => void update((s) => ({ ...s, tts: { ...s.tts, kind: on ? 'browser' : 'off' } }))}
            label={t('settings.voice.readAloud')}
            description={t('settings.voice.readAloudHint')}
          />

          {settings.tts.kind === 'browser' && (
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
            </div>
          )}
        </>
      )}
    </Section>
  )
}
