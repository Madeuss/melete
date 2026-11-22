import { useTranslation } from 'react-i18next'
import { useSettings } from '../../app/settingsContext'
import { Notice } from '../../ui'
import { PageHeader } from '../../ui/PageHeader'
import { DataSection } from './DataSection'
import { LlmSection } from './LlmSection'
import { AppearanceSection, LanguageSection } from './PreferencesSection'
import { VoiceSection } from './VoiceSection'

export default function SettingsPage() {
  const { t } = useTranslation()
  const { settings } = useSettings()

  return (
    <>
      <PageHeader title={t('settings.title')} description={t('settings.intro')} />
      {!settings.llm && <Notice className="-mt-4 mb-10" title={t('settings.firstRun')} />}
      <div className="flex flex-col gap-12">
        <LlmSection />
        <hr className="border-border" />
        <VoiceSection />
        <hr className="border-border" />
        <LanguageSection />
        <hr className="border-border" />
        <AppearanceSection />
        <hr className="border-border" />
        <DataSection />
      </div>
    </>
  )
}
