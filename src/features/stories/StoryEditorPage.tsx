import { ArrowLeft, Trash2 } from 'lucide-react'
import { useId, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { STORY_LIMITS, SUGGESTED_TAGS, normalizeTag, type Story, type StoryInput } from '../../schemas'
import { useAllTags, useStory } from '../../storage/hooks'
import { getRepositories } from '../../storage/repositories'
import {
  Button,
  Chip,
  Dialog,
  Field,
  Input,
  Notice,
  Textarea,
  ToggleChip,
  buttonClasses,
  describedBy,
  iconPropsSm,
} from '../../ui'
import { PageHeader } from '../../ui/PageHeader'
import { StoryAssistant } from './StoryAssistant'

const STAR = ['situation', 'task', 'action', 'result'] as const

/** Shows how much room is left, only once the text gets close to the limit. */
function CharCount({ value, max }: { value: string; max: number }) {
  const { t } = useTranslation()
  if (value.length < max * 0.8) return null
  return (
    <p className="self-end text-caption text-text-subtle" aria-live="polite">
      {t('stories.charCount', { count: value.length, max })}
    </p>
  )
}

const empty: StoryInput = { title: '', situation: '', task: '', action: '', result: '', tags: [] }

function Editor({ story }: { story?: Story }) {
  const { t } = useTranslation()
  const ids = useId()
  const navigate = useNavigate()
  const existingTags = useAllTags()
  // "Write a story for <competency>" from the coverage map arrives with ?tag=…
  const [params] = useSearchParams()
  const [form, setForm] = useState<StoryInput>(() => {
    if (story) return story
    const tag = normalizeTag(params.get('tag') ?? '')
    return tag ? { ...empty, tags: [tag] } : empty
  })
  const [tagDraft, setTagDraft] = useState('')
  const [titleError, setTitleError] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  const suggestions = [...new Set([...SUGGESTED_TAGS, ...(existingTags ?? [])])]
    .filter((tag) => !form.tags.includes(tag))
    .slice(0, 14)

  function addTag(raw: string) {
    const tag = normalizeTag(raw)
    if (tag && !form.tags.includes(tag)) setForm((f) => ({ ...f, tags: [...f.tags, tag] }))
  }

  function onTagKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(tagDraft)
      setTagDraft('')
    } else if (e.key === 'Backspace' && !tagDraft && form.tags.length) {
      setForm((f) => ({ ...f, tags: f.tags.slice(0, -1) }))
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const input = { ...form, tags: tagDraft.trim() ? [...form.tags, normalizeTag(tagDraft)] : form.tags }
    if (!input.title.trim()) {
      setTitleError(true)
      document.getElementById(`${ids}-title`)?.focus()
      return
    }
    setSaving(true)
    const repo = getRepositories().stories
    if (story) await repo.update(story.id, input)
    else await repo.create(input)
    navigate('/stories')
  }

  async function onDelete() {
    if (!story) return
    await getRepositories().stories.remove(story.id)
    navigate('/stories')
  }

  return (
    <>
      <Link to="/stories" className={buttonClasses('ghost', 'sm', '-ml-4 mb-6')}>
        <ArrowLeft {...iconPropsSm} />
        {t('stories.title')}
      </Link>
      <PageHeader
        title={story ? t('stories.editor.editTitle') : t('stories.editor.newTitle')}
        description={t('stories.editor.description')}
      />
      <div className="mb-10">
        <StoryAssistant
          initialNarrative={story ? '' : (params.get('from') ?? '')}
          onResult={(r) =>
            // The assistant fills the STAR parts it found; what it left empty keeps what was typed.
            // The title is only filled in when there isn't one yet.
            setForm((f) => ({
              title: f.title.trim() ? f.title : r.title,
              situation: r.situation || f.situation,
              task: r.task || f.task,
              action: r.action || f.action,
              result: r.result || f.result,
              tags: [...new Set([...f.tags, ...r.tags])],
            }))
          }
        />
      </div>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
        <Field
          id={`${ids}-title`}
          label={t('stories.editor.title')}
          error={titleError ? t('stories.editor.titleRequired') : undefined}
        >
          <Input
            id={`${ids}-title`}
            value={form.title}
            maxLength={STORY_LIMITS.title}
            placeholder={t('stories.editor.titlePlaceholder')}
            onChange={(e) => {
              setForm({ ...form, title: e.target.value })
              if (e.target.value.trim()) setTitleError(false)
            }}
            aria-invalid={titleError || undefined}
            aria-describedby={describedBy(`${ids}-title`, { error: titleError })}
          />
        </Field>

        {STAR.map((part) => (
          <Field
            key={part}
            id={`${ids}-${part}`}
            label={t(`stories.editor.${part}`)}
            hint={t(`stories.editor.${part}Hint`)}
          >
            <div className="flex flex-col gap-1">
              <Textarea
                id={`${ids}-${part}`}
                rows={part === 'action' ? 5 : 3}
                maxLength={STORY_LIMITS.part}
                value={form[part]}
                onChange={(e) => setForm({ ...form, [part]: e.target.value })}
                aria-describedby={`${ids}-${part}-hint`}
              />
              <CharCount value={form[part]} max={STORY_LIMITS.part} />
            </div>
          </Field>
        ))}

        <Field id={`${ids}-tags`} label={t('stories.editor.tags')} hint={t('stories.editor.tagsHint')}>
          <div className="flex flex-col gap-3">
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.tags.map((tag) => (
                  <Chip
                    key={tag}
                    removeLabel={t('stories.editor.removeTag', { tag })}
                    onRemove={() => setForm((f) => ({ ...f, tags: f.tags.filter((x) => x !== tag) }))}
                  >
                    {tag}
                  </Chip>
                ))}
              </div>
            )}
            <Input
              id={`${ids}-tags`}
              value={tagDraft}
              placeholder={t('stories.editor.tagPlaceholder')}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={onTagKey}
              onBlur={() => {
                if (tagDraft.trim()) {
                  addTag(tagDraft)
                  setTagDraft('')
                }
              }}
              aria-describedby={`${ids}-tags-hint`}
            />
            {suggestions.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-caption text-text-subtle">{t('stories.editor.suggested')}</span>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((tag) => (
                    <ToggleChip key={tag} selected={false} onClick={() => addTag(tag)}>
                      {tag}
                    </ToggleChip>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Field>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-8">
          <Button type="submit" variant="primary" loading={saving}>
            {t('stories.editor.save')}
          </Button>
          <Link to="/stories" className={buttonClasses('secondary')}>
            {t('common.cancel')}
          </Link>
          {story && (
            <Button
              variant="danger"
              className="sm:ml-auto"
              icon={<Trash2 {...iconPropsSm} />}
              onClick={() => setConfirmDelete(true)}
            >
              {t('common.delete')}
            </Button>
          )}
        </div>
      </form>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('stories.editor.deleteTitle')}
        actions={
          <>
            <Button onClick={() => setConfirmDelete(false)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={onDelete}>
              {t('common.delete')}
            </Button>
          </>
        }
      >
        {t('stories.editor.deleteBody')}
      </Dialog>
    </>
  )
}

export default function StoryEditorPage() {
  const { t } = useTranslation()
  const { storyId } = useParams()
  const story = useStory(storyId)

  if (!storyId) return <Editor />
  if (story === undefined) return null // loading
  if (story === null)
    return (
      <Notice
        tone="warning"
        title={t('stories.editor.notFound')}
        action={
          <Link to="/stories" className={buttonClasses('secondary', 'sm')}>
            {t('stories.title')}
          </Link>
        }
      />
    )
  return <Editor key={story.id} story={story} />
}
