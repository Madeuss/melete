import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../ui/PageHeader'

// Placeholder until the screen is built.
export default function Page() {
  const { t } = useTranslation()
  return <PageHeader title={t('nav.newInterview')} />
}
