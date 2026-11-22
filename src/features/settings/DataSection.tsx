import { Download, Trash2, Upload } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { dateStamp, downloadJson, readJsonFile } from '../../app/files'
import { useSettings } from '../../app/settingsContext'
import { getRepositories } from '../../storage/repositories'
import { Button, Dialog, Notice, iconPropsSm } from '../../ui'
import { Section } from '../../ui/PageHeader'

export function DataSection() {
  const { t } = useTranslation()
  const { reload } = useSettings()
  const ids = useId()
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>()
  const [confirmWipe, setConfirmWipe] = useState(false)

  async function onExport() {
    downloadJson(`melete-${dateStamp()}.json`, await getRepositories().data.exportAll())
  }

  async function onImport(file: File | undefined) {
    if (!file) return
    try {
      const counts = await getRepositories().data.importFile(await readJsonFile(file))
      setMessage({ tone: 'success', text: t('settings.data.imported', counts) })
    } catch {
      setMessage({ tone: 'danger', text: t('settings.data.importFailed') })
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function onWipe() {
    await getRepositories().data.wipe()
    setConfirmWipe(false)
    await reload()
  }

  return (
    <Section id={`${ids}-title`} title={t('settings.data.title')} description={t('settings.data.description')}>
      <div className="flex flex-wrap gap-3">
        <Button icon={<Download {...iconPropsSm} />} onClick={onExport}>
          {t('settings.data.export')}
        </Button>
        <Button icon={<Upload {...iconPropsSm} />} onClick={() => fileInput.current?.click()}>
          {t('settings.data.import')}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => void onImport(e.target.files?.[0])}
        />
        <Button variant="danger" icon={<Trash2 {...iconPropsSm} />} onClick={() => setConfirmWipe(true)}>
          {t('settings.data.wipe')}
        </Button>
      </div>
      {message && <Notice tone={message.tone} title={message.text} />}

      <Dialog
        open={confirmWipe}
        onClose={() => setConfirmWipe(false)}
        title={t('settings.data.wipeTitle')}
        actions={
          <>
            <Button onClick={() => setConfirmWipe(false)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={onWipe}>
              {t('settings.data.wipeConfirm')}
            </Button>
          </>
        }
      >
        {t('settings.data.wipeBody')}
      </Dialog>
    </Section>
  )
}
