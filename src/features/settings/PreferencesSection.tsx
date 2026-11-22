import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../app/settingsContext'
import { LANGUAGE_NAMES } from '../../i18n'
import { InterviewLanguage, ThemePreference, UiLanguage } from '../../schemas'
import { Field, SegmentedControl, Select } from '../../ui'
import { Section } from '../../ui/PageHeader'

export function LanguageSection() {
  const { t } = useTranslation()
  const { settings, update } = useSettings()
  const ids = useId()

  return (
    <Section id={`${ids}-title`} title={t('settings.language.title')}>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field id={`${ids}-ui`} label={t('settings.language.ui')}>
          <Select
            id={`${ids}-ui`}
            value={settings.uiLanguage}
            onChange={(e) => void update({ uiLanguage: UiLanguage.parse(e.target.value) })}
          >
            {UiLanguage.options.map((l) => (
              <option key={l} value={l} lang={l}>
                {LANGUAGE_NAMES[l]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={`${ids}-iv`} label={t('settings.language.interview')} hint={t('settings.language.interviewHint')}>
          <Select
            id={`${ids}-iv`}
            value={settings.interviewLanguage}
            aria-describedby={`${ids}-iv-hint`}
            onChange={(e) =>
              void update((s) => ({
                ...s,
                interviewLanguage: InterviewLanguage.parse(e.target.value),
                // the chosen voice belongs to the old language
                tts: { ...s.tts, voice: undefined },
              }))
            }
          >
            <option value="en" lang="en">
              English
            </option>
            <option value="pt" lang="pt-BR">
              Português
            </option>
          </Select>
        </Field>
      </div>
    </Section>
  )
}

export function AppearanceSection() {
  const { t } = useTranslation()
  const { settings, update } = useSettings()
  const ids = useId()

  return (
    <Section id={`${ids}-title`} title={t('settings.appearance.title')}>
      <div className="flex flex-col gap-2">
        <span id={`${ids}-theme`} className="text-sm font-medium">
          {t('settings.appearance.theme')}
        </span>
        <SegmentedControl
          aria-labelledby={`${ids}-theme`}
          value={settings.theme}
          onChange={(theme) => void update({ theme: ThemePreference.parse(theme) })}
          options={[
            { value: 'system', label: t('settings.appearance.system') },
            { value: 'light', label: t('settings.appearance.light') },
            { value: 'dark', label: t('settings.appearance.dark') },
          ]}
        />
      </div>
    </Section>
  )
}
