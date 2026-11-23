import { FileUp, Plus, Trash2 } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { llmErrorMessage, type ErrorMessage } from '../../app/errors'
import { structureProfile } from '../../app/services'
import { useSettings } from '../../app/settingsContext'
import { DocumentError, extractText } from '../../providers/documents/extractText'
import type { Experience, Profile, ProfileInput } from '../../schemas'
import { useProfile } from '../../storage/hooks'
import { getRepositories } from '../../storage/repositories'
import { Button, Card, Dialog, Field, Input, Notice, Textarea, iconPropsSm } from '../../ui'
import { PageHeader } from '../../ui/PageHeader'

const lines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

const emptyExperience = (): Experience => ({ company: '', title: '', start: '', end: '', achievements: [] })

/** The editor keeps list fields as text (one item per line) until saving. */
interface Draft {
  headline: string
  experiences: Array<Omit<Experience, 'achievements'> & { achievements: string }>
  skills: string
  education: string
  languages: string
}

function toDraft(p: ProfileInput): Draft {
  return {
    headline: p.headline,
    experiences: p.experiences.map((e) => ({ ...e, achievements: e.achievements.join('\n') })),
    skills: p.skills.join('\n'),
    education: p.education.join('\n'),
    languages: p.languages.join('\n'),
  }
}

function fromDraft(d: Draft): ProfileInput {
  return {
    headline: d.headline.trim(),
    experiences: d.experiences
      .map((e) => ({
        company: e.company.trim(),
        title: e.title.trim(),
        start: e.start.trim(),
        end: e.end.trim(),
        achievements: lines(e.achievements),
      }))
      .filter((e) => e.company || e.title),
    skills: lines(d.skills),
    education: lines(d.education),
    languages: lines(d.languages),
  }
}

/** Upload (PDF/DOCX, read in the browser) or paste the CV, then let the model structure it. */
function Importer({ onDraft }: { onDraft: (p: ProfileInput) => void }) {
  const { t } = useTranslation()
  const { settings } = useSettings()
  const ids = useId()
  const fileInput = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string>()
  const [reading, setReading] = useState(false)
  const [organizing, setOrganizing] = useState(false)
  const [error, setError] = useState<ErrorMessage>()

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(undefined)
    setReading(true)
    try {
      setText(await extractText(file))
      setFileName(file.name)
    } catch (err) {
      const kind = err instanceof DocumentError ? err.kind : 'unreadable'
      setError({ title: t(`profile.fileErrors.${kind}`), action: t('profile.fileErrorAction') })
    } finally {
      setReading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function organize() {
    if (!settings.llm || !text.trim()) return
    setOrganizing(true)
    setError(undefined)
    try {
      onDraft(await structureProfile(settings.llm, { cvText: text }))
    } catch (err) {
      setError(llmErrorMessage(t, err, settings.llm.preset))
    } finally {
      setOrganizing(false)
    }
  }

  return (
    <Card tone="subtle" size="panel" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg">{t('profile.importTitle')}</h2>
        <p className="text-sm text-text-muted">{t('profile.importHint')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button icon={<FileUp {...iconPropsSm} />} loading={reading} onClick={() => fileInput.current?.click()}>
          {t('profile.chooseFile')}
        </Button>
        {fileName && <span className="text-sm text-text-muted">{t('profile.fileRead', { name: fileName })}</span>}
        <input
          ref={fileInput}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </div>
      <Field id={`${ids}-text`} label={t('profile.cvText')} hint={t('profile.cvTextHint')}>
        <Textarea
          id={`${ids}-text`}
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-describedby={`${ids}-text-hint`}
        />
      </Field>
      {!settings.llm && (
        <Notice
          tone="info"
          title={t('profile.needsProvider')}
          action={
            <Link to="/settings" className="text-sm font-medium text-brand-text hover:underline">
              {t('newInterview.change')}
            </Link>
          }
        />
      )}
      {error && (
        <Notice tone="danger" title={error.title}>
          <p>{error.action}</p>
        </Notice>
      )}
      <div>
        <Button variant="primary" loading={organizing} disabled={!text.trim() || !settings.llm} onClick={() => void organize()}>
          {t('profile.organize')}
        </Button>
      </div>
    </Card>
  )
}

/** Review and edit the structured profile, then save it. */
function Editor({ initial, saved, onSaved }: { initial: ProfileInput; saved?: Profile; onSaved: () => void }) {
  const { t } = useTranslation()
  const ids = useId()
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial))
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const setExp = (i: number, patch: Partial<Draft['experiences'][number]>) =>
    setDraft((d) => ({ ...d, experiences: d.experiences.map((e, j) => (j === i ? { ...e, ...patch } : e)) }))

  async function save() {
    setSaving(true)
    await getRepositories().profile.save(fromDraft(draft))
    setSaving(false)
    onSaved()
  }

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      {!saved && <Notice tone="info" title={t('profile.reviewTitle')}>{t('profile.reviewBody')}</Notice>}

      <Field id={`${ids}-headline`} label={t('profile.headline')}>
        <Input id={`${ids}-headline`} value={draft.headline} onChange={(e) => set({ headline: e.target.value })} />
      </Field>

      <section aria-labelledby={`${ids}-exp`} className="flex flex-col gap-4">
        <h2 id={`${ids}-exp`} className="text-lg">
          {t('profile.experiences')}
        </h2>
        {draft.experiences.map((e, i) => (
          <Card key={i} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={`${ids}-c${i}`} label={t('profile.company')}>
                <Input id={`${ids}-c${i}`} value={e.company} onChange={(ev) => setExp(i, { company: ev.target.value })} />
              </Field>
              <Field id={`${ids}-t${i}`} label={t('profile.jobTitle')}>
                <Input id={`${ids}-t${i}`} value={e.title} onChange={(ev) => setExp(i, { title: ev.target.value })} />
              </Field>
              <Field id={`${ids}-s${i}`} label={t('profile.start')}>
                <Input id={`${ids}-s${i}`} value={e.start} onChange={(ev) => setExp(i, { start: ev.target.value })} />
              </Field>
              <Field id={`${ids}-e${i}`} label={t('profile.end')} hint={t('profile.endHint')}>
                <Input
                  id={`${ids}-e${i}`}
                  value={e.end}
                  onChange={(ev) => setExp(i, { end: ev.target.value })}
                  aria-describedby={`${ids}-e${i}-hint`}
                />
              </Field>
            </div>
            <Field id={`${ids}-a${i}`} label={t('profile.achievements')} hint={t('profile.onePerLine')}>
              <Textarea
                id={`${ids}-a${i}`}
                rows={3}
                value={e.achievements}
                onChange={(ev) => setExp(i, { achievements: ev.target.value })}
                aria-describedby={`${ids}-a${i}-hint`}
              />
            </Field>
            {saved && lines(e.achievements).length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-sm text-text-muted">{t('profile.toStoryHint')}</span>
                <ul className="flex flex-col gap-1">
                  {lines(e.achievements).map((a) => (
                    <li key={a} className="text-sm">
                      <Link
                        to={`/stories/new?from=${encodeURIComponent(`${a} (${e.title}, ${e.company})`)}`}
                        className="text-brand-text hover:underline"
                      >
                        {t('profile.toStory', { achievement: a })}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 {...iconPropsSm} />}
                onClick={() => setDraft((d) => ({ ...d, experiences: d.experiences.filter((_, j) => j !== i) }))}
              >
                {t('profile.removeExperience')}
              </Button>
            </div>
          </Card>
        ))}
        <div>
          <Button
            size="sm"
            icon={<Plus {...iconPropsSm} />}
            onClick={() =>
              setDraft((d) => ({ ...d, experiences: [...d.experiences, { ...emptyExperience(), achievements: '' }] }))
            }
          >
            {t('profile.addExperience')}
          </Button>
        </div>
      </section>

      {(['skills', 'education', 'languages'] as const).map((k) => (
        <Field key={k} id={`${ids}-${k}`} label={t(`profile.${k}`)} hint={t('profile.onePerLine')}>
          <Textarea
            id={`${ids}-${k}`}
            rows={3}
            value={draft[k]}
            onChange={(e) => set({ [k]: e.target.value })}
            aria-describedby={`${ids}-${k}-hint`}
          />
        </Field>
      ))}

      <div className="border-t border-border pt-8">
        <Button type="submit" variant="primary" loading={saving}>
          {t('profile.save')}
        </Button>
      </div>
    </form>
  )
}

export default function ProfilePage() {
  const { t } = useTranslation()
  const profile = useProfile()
  /** A freshly organized CV, not saved yet (replaces the editor's content). */
  const [imported, setImported] = useState<ProfileInput>()
  const [reimport, setReimport] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [savedNotice, setSavedNotice] = useState(false)

  if (profile === undefined) return null
  const showImporter = !imported && (!profile || reimport)

  return (
    <>
      <PageHeader
        title={t('profile.title')}
        description={t('profile.description')}
        actions={
          profile && !showImporter && !imported ? (
            <>
              <Button variant="ghost" icon={<FileUp {...iconPropsSm} />} onClick={() => setReimport(true)}>
                {t('profile.replace')}
              </Button>
              <Button variant="ghost" icon={<Trash2 {...iconPropsSm} />} onClick={() => setConfirmDelete(true)}>
                {t('profile.delete')}
              </Button>
            </>
          ) : undefined
        }
      />
      <div className="flex flex-col gap-8">
        {savedNotice && <Notice tone="success" title={t('profile.saved')} />}
        {showImporter && (
          <Importer
            onDraft={(p) => {
              setImported(p)
              setReimport(false)
              setSavedNotice(false)
            }}
          />
        )}
        {(imported ?? (profile && !showImporter ? profile : undefined)) && (
          <Editor
            key={imported ? 'imported' : profile!.updatedAt}
            initial={imported ?? profile!}
            saved={imported ? undefined : profile!}
            onSaved={() => {
              setImported(undefined)
              setSavedNotice(true)
            }}
          />
        )}
      </div>
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('profile.deleteTitle')}
        actions={
          <>
            <Button onClick={() => setConfirmDelete(false)}>{t('common.cancel')}</Button>
            <Button
              variant="danger"
              onClick={async () => {
                setConfirmDelete(false)
                setSavedNotice(false)
                await getRepositories().profile.remove()
              }}
            >
              {t('common.delete')}
            </Button>
          </>
        }
      >
        {t('profile.deleteBody')}
      </Dialog>
    </>
  )
}
