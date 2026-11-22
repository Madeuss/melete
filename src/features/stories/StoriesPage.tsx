import { Download, Plus, Search, Upload } from 'lucide-react'
import { useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { dateStamp, downloadJson, readJsonFile } from '../../app/files'
import { formatDate } from '../../app/format'
import { getRepositories } from '../../storage/repositories'
import { useStories } from '../../storage/hooks'
import { Button, Card, Chip, Input, Notice, SegmentedControl, ToggleChip, buttonClasses, iconPropsSm } from '../../ui'
import { PageHeader } from '../../ui/PageHeader'
import { CoverageView } from './CoverageView'

export default function StoriesPage() {
  const { t, i18n } = useTranslation()
  const ids = useId()
  const stories = useStories()
  const [query, setQuery] = useState('')
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>()
  const fileInput = useRef<HTMLInputElement>(null)
  // The view lives in the URL, so the coverage map can be linked to and survives going back.
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'coverage' ? 'coverage' : 'list'

  const tags = useMemo(() => [...new Set((stories ?? []).flatMap((s) => s.tags))].sort(), [stories])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (stories ?? []).filter((s) => {
      if (activeTags.length && !activeTags.every((tag) => s.tags.includes(tag))) return false
      if (!q) return true
      return [s.title, s.situation, s.task, s.action, s.result, ...s.tags].some((f) => f.toLowerCase().includes(q))
    })
  }, [stories, query, activeTags])

  async function onExport() {
    downloadJson(`melete-stories-${dateStamp()}.json`, await getRepositories().data.exportStories())
  }

  async function onImport(file: File | undefined) {
    if (!file) return
    try {
      const { stories: count } = await getRepositories().data.importFile(await readJsonFile(file))
      setMessage({ tone: 'success', text: t('stories.imported', { count }) })
    } catch {
      setMessage({ tone: 'danger', text: t('stories.importFailed') })
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const newButton = (
    <Link to="/stories/new" className={buttonClasses('primary')}>
      <Plus {...iconPropsSm} />
      {t('stories.new')}
    </Link>
  )

  return (
    <>
      <PageHeader
        title={t('stories.title')}
        description={t('stories.description')}
        actions={
          <>
            <Button variant="ghost" icon={<Upload {...iconPropsSm} />} onClick={() => fileInput.current?.click()}>
              {t('stories.import')}
            </Button>
            {!!stories?.length && (
              <Button variant="ghost" icon={<Download {...iconPropsSm} />} onClick={onExport}>
                {t('stories.export')}
              </Button>
            )}
            {!!stories?.length && newButton}
          </>
        }
      />
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void onImport(e.target.files?.[0])}
      />

      {message && <Notice className="mb-8" tone={message.tone} title={message.text} />}

      {stories && stories.length === 0 && (
        <Card tone="subtle" size="panel" className="flex flex-col items-start gap-4">
          <h2 className="text-lg">{t('stories.emptyTitle')}</h2>
          <p className="max-w-prose text-text-muted">{t('stories.emptyBody')}</p>
          {newButton}
        </Card>
      )}

      {stories && stories.length > 0 && (
        <div className="mb-8">
          <SegmentedControl
            aria-label={t('stories.views.label')}
            value={view}
            onChange={(v) => setParams(v === 'coverage' ? { view: v } : {}, { replace: true })}
            options={[
              { value: 'list', label: t('stories.views.list') },
              { value: 'coverage', label: t('stories.views.coverage') },
            ]}
          />
        </div>
      )}

      {stories && stories.length > 0 && view === 'coverage' && <CoverageView stories={stories} />}

      {stories && stories.length > 0 && view === 'list' && (
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <div className="relative">
              <Search
                {...iconPropsSm}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <Input
                type="search"
                aria-label={t('stories.search')}
                placeholder={t('stories.search')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-11"
              />
            </div>
            {tags.length > 0 && (
              <div role="group" aria-labelledby={`${ids}-tags`} className="flex flex-col gap-2">
                <span id={`${ids}-tags`} className="sr-only">
                  {t('stories.filterByTag')}
                </span>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <ToggleChip
                      key={tag}
                      selected={activeTags.includes(tag)}
                      onSelectedChange={(on) =>
                        setActiveTags((cur) => (on ? [...cur, tag] : cur.filter((x) => x !== tag)))
                      }
                    >
                      {tag}
                    </ToggleChip>
                  ))}
                </div>
              </div>
            )}
          </div>

          <p className="text-sm text-text-subtle" aria-live="polite">
            {t('stories.count', { count: filtered.length })}
          </p>

          {filtered.length === 0 ? (
            <p className="text-text-muted">{t('stories.noMatches')}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {filtered.map((s) => (
                <li key={s.id}>
                  <Link
                    to={`/stories/${s.id}`}
                    className="flex flex-col gap-3 rounded-card border border-border bg-bg p-6 transition-colors duration-150 ease-out hover:border-border-strong hover:bg-surface-subtle"
                  >
                    <div className="flex flex-col gap-1">
                      <h2 className="text-base font-semibold">{s.title}</h2>
                      {s.situation && <p className="line-clamp-2 text-sm text-text-muted">{s.situation}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {s.tags.map((tag) => (
                        <Chip key={tag}>{tag}</Chip>
                      ))}
                      <span className="ml-auto text-caption text-text-subtle">
                        {t('stories.updated', { date: formatDate(s.updatedAt, i18n.language) })}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  )
}
