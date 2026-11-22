import { Keyboard, Mic, Trash2 } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { llmErrorMessage, sttErrorMessage, type ErrorMessage } from '../../app/errors'
import { formatDate, formatNumber } from '../../app/format'
import { canUseVoice, evaluatePitch, sttFromSettings } from '../../app/services'
import { useSettings } from '../../app/settingsContext'
import { useMicLevel } from '../../app/useMicLevel'
import { computeMetrics } from '../../interview/metrics'
import { comparePitches, formatClock, pitchAverage, pitchSeconds } from '../../interview/pitch'
import type { SpeechToText, SttError } from '../../providers/stt/types'
import type { Pitch } from '../../schemas'
import { usePitches } from '../../storage/hooks'
import { getRepositories } from '../../storage/repositories'
import {
  Button,
  Card,
  Dialog,
  Field,
  Input,
  Notice,
  RecordButton,
  Textarea,
  ToggleChip,
  iconPropsSm,
} from '../../ui'
import { PageHeader } from '../../ui/PageHeader'
import { Delta } from '../report/RetryViews'
import { PitchFeedbackView, PitchTimer } from './PitchParts'

const ROLE_KEY = 'melete.pitchRole'

function loadRole(): string {
  try {
    const saved = localStorage.getItem(ROLE_KEY)
    if (saved !== null) return saved
    // Default to the role of the last interview setup.
    return (JSON.parse(localStorage.getItem('melete.lastConfig') ?? '{}') as { role?: string }).role ?? ''
  } catch {
    return ''
  }
}

type Phase = 'idle' | 'recording' | 'review'

/** Record (or type) a version, review it, then evaluate and save it. */
function Practice({ onSaved }: { onSaved: (id: string) => void }) {
  const { t } = useTranslation()
  const { settings } = useSettings()
  const ids = useId()
  const voice = canUseVoice(settings)
  const [mode, setMode] = useState<'voice' | 'typed'>(voice ? 'voice' : 'typed')
  const [role, setRole] = useState(loadRole)
  const [phase, setPhase] = useState<Phase>('idle')
  const [draft, setDraft] = useState('')
  const [partial, setPartial] = useState('')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [durationMs, setDurationMs] = useState<number>()
  const [sttError, setSttError] = useState<SttError>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<ErrorMessage>()
  const stt = useRef<SpeechToText>(undefined)
  const startedAt = useRef(0)
  const level = useMicLevel(phase === 'recording')

  useEffect(() => {
    if (phase !== 'recording') return
    const timer = setInterval(() => setElapsedMs(Date.now() - startedAt.current), 250)
    return () => clearInterval(timer)
  }, [phase])

  useEffect(() => () => stt.current?.abort(), [])

  function start() {
    setSttError(undefined)
    setError(undefined)
    setPartial('')
    setElapsedMs(0)
    stt.current = sttFromSettings(settings)
    startedAt.current = Date.now()
    setPhase('recording')
    stt.current.start(setPartial, (err) => {
      setSttError(err)
      setPhase('idle')
      setMode('typed')
    })
  }

  async function stop() {
    const ms = Date.now() - startedAt.current
    const text = (await stt.current?.stop()) ?? ''
    setDraft(text || partial)
    setDurationMs(ms)
    setPhase('review')
  }

  function reset() {
    setDraft('')
    setPartial('')
    setElapsedMs(0)
    setDurationMs(undefined)
    setError(undefined)
    setPhase('idle')
  }

  async function save() {
    const transcript = draft.trim()
    if (!transcript) return
    try {
      localStorage.setItem(ROLE_KEY, role.trim())
    } catch {
      // a convenience only
    }
    setSaving(true)
    setError(undefined)
    const typed = mode === 'typed' || durationMs === undefined
    const repo = getRepositories().pitches
    // Saved first, so a failed evaluation never loses the version.
    const pitch = await repo.add({
      language: settings.interviewLanguage,
      ...(role.trim() ? { role: role.trim() } : {}),
      transcript,
      ...(typed ? {} : { durationMs }),
      metrics: computeMetrics(transcript, settings.interviewLanguage, typed ? undefined : durationMs),
    })
    try {
      if (settings.llm) {
        const feedback = await evaluatePitch(settings.llm, {
          transcript,
          role: pitch.role,
          seconds: typed ? undefined : Math.round(durationMs! / 1000),
          metrics: pitch.metrics,
          language: settings.interviewLanguage,
          feedbackLanguage: settings.uiLanguage,
        })
        await repo.update(pitch.id, { feedback })
      }
      reset()
      onSaved(pitch.id)
    } catch (err) {
      setError(llmErrorMessage(t, err, settings.llm?.preset))
      onSaved(pitch.id)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card tone="subtle" size="panel" className="flex flex-col gap-8">
      <Field id={`${ids}-role`} label={`${t('pitch.role')} (${t('common.optional')})`} hint={t('pitch.roleHint')}>
        <Input
          id={`${ids}-role`}
          value={role}
          placeholder={t('newInterview.rolePlaceholder')}
          onChange={(e) => setRole(e.target.value)}
          aria-describedby={`${ids}-role-hint`}
        />
      </Field>

      {sttError && <Notice tone="warning" title={sttErrorMessage(t, sttError)} />}

      {phase !== 'review' && mode === 'voice' && (
        <div className="flex flex-col items-center gap-6">
          <PitchTimer seconds={elapsedMs / 1000} live />
          <RecordButton
            recording={phase === 'recording'}
            level={level}
            onClick={() => (phase === 'recording' ? void stop() : start())}
            label={phase === 'recording' ? t('room.stopRecording') : t('room.startRecording')}
          />
          <p className="text-sm text-text-muted" aria-live="polite">
            {phase === 'recording' ? t('room.recording') : t('pitch.tapToStart')}
          </p>
          {phase === 'recording' && (
            <p className="min-h-16 w-full whitespace-pre-wrap text-reading text-text-muted">{partial || '…'}</p>
          )}
          {phase === 'idle' && (
            <Button variant="ghost" size="sm" icon={<Keyboard {...iconPropsSm} />} onClick={() => setMode('typed')}>
              {t('room.preferTyping')}
            </Button>
          )}
        </div>
      )}

      {(phase === 'review' || mode === 'typed') && (
        <div className="flex flex-col gap-4">
          {phase === 'review' && durationMs !== undefined && <PitchTimer seconds={durationMs / 1000} />}
          <Field
            id={`${ids}-draft`}
            label={t('pitch.yourPitch')}
            hint={phase === 'review' ? t('room.reviewHint') : t('pitch.typeHint')}
          >
            <Textarea
              id={`${ids}-draft`}
              reading
              rows={7}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-describedby={`${ids}-draft-hint`}
            />
          </Field>
          {!settings.llm && (
            <Notice
              tone="info"
              title={t('pitch.needsProvider')}
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
              <p className="mt-1">{t('pitch.savedWithoutFeedback')}</p>
            </Notice>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" loading={saving} disabled={!draft.trim()} onClick={() => void save()}>
              {settings.llm ? t('pitch.evaluate') : t('pitch.saveOnly')}
            </Button>
            {phase === 'review' && <Button onClick={reset}>{t('room.retake')}</Button>}
            {phase !== 'review' && voice && (
              <Button variant="ghost" icon={<Mic {...iconPropsSm} />} onClick={() => setMode('voice')}>
                {t('room.preferSpeaking')}
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

/** Two versions side by side, the older one first. */
function Comparison({ older, newer }: { older: Pitch; newer: Pitch }) {
  const { t, i18n } = useTranslation()
  const n = (x: number | undefined) => (x === undefined ? '–' : formatNumber(x, i18n.language))
  const c = comparePitches(older, newer)
  const clock = (s: { seconds: number; estimated: boolean }) => `${s.estimated ? '~' : ''}${formatClock(s.seconds)}`
  const label = (key: (typeof c.scores)[number]['key']) =>
    key === 'average' ? t('report.compare.average') : t(`pitch.scores.${key}`)
  return (
    <Card tone="subtle" className="flex flex-col gap-6">
      <h3 className="text-base font-semibold">{t('pitch.compareTitle')}</h3>
      <div className="relative overflow-x-auto">
        <table className="w-full text-left text-sm tabular-nums">
          <thead className="text-text-muted">
            <tr className="border-b border-border">
              <th scope="col" className="py-2 pr-4 font-medium">{t('report.compare.item')}</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">{formatDate(older.createdAt, i18n.language, true)}</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">{formatDate(newer.createdAt, i18n.language, true)}</th>
              <th scope="col" className="py-2 text-right font-medium">{t('report.compare.change')}</th>
            </tr>
          </thead>
          <tbody>
            {c.scores.map((s) => (
              <tr key={s.key} className="border-b border-border">
                <th scope="row" className="py-2 pr-4 font-normal">{label(s.key)}</th>
                <td className="py-2 pr-4 text-right">{n(s.before)}</td>
                <td className="py-2 pr-4 text-right">{n(s.after)}</td>
                <td className="py-2 text-right">
                  <Delta before={s.before} after={s.after} />
                </td>
              </tr>
            ))}
            <tr className="border-b border-border">
              <th scope="row" className="py-2 pr-4 font-normal">{t('pitch.duration')}</th>
              <td className="py-2 pr-4 text-right">{clock(c.seconds.before)}</td>
              <td className="py-2 pr-4 text-right">{clock(c.seconds.after)}</td>
              <td className="py-2 text-right text-text-subtle">–</td>
            </tr>
            <tr className="border-b border-border">
              <th scope="row" className="py-2 pr-4 font-normal">{t('report.compare.wpm')}</th>
              <td className="py-2 pr-4 text-right">{n(c.wordsPerMinute.before)}</td>
              <td className="py-2 pr-4 text-right">{n(c.wordsPerMinute.after)}</td>
              <td className="py-2 text-right text-text-subtle">–</td>
            </tr>
            <tr>
              <th scope="row" className="py-2 pr-4 font-normal">{t('feedback.fillers')}</th>
              <td className="py-2 pr-4 text-right">{n(c.fillers.before)}</td>
              <td className="py-2 pr-4 text-right">{n(c.fillers.after)}</td>
              <td className="py-2 text-right">
                <Delta before={c.fillers.before} after={c.fillers.after} lowerIsBetter />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {[older, newer].map((p) => (
          <div key={p.id} className="flex flex-col gap-2">
            <h4 className="text-sm font-medium">{formatDate(p.createdAt, i18n.language, true)}</h4>
            <p className="whitespace-pre-wrap text-reading">{p.transcript}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}

/** Saved versions, newest first: open one, delete one, or pick two to compare. */
function Versions({ pitches, openId, onOpen }: { pitches: Pitch[]; openId?: string; onOpen: (id?: string) => void }) {
  const { t, i18n } = useTranslation()
  const [picked, setPicked] = useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = useState<Pitch>()
  const chosen = pitches.filter((p) => picked.includes(p.id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  return (
    <section aria-labelledby="pitch-versions" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 id="pitch-versions" className="text-lg">
          {t('pitch.versions', { count: pitches.length })}
        </h2>
        {pitches.length > 1 && <p className="text-sm text-text-muted">{t('pitch.compareHint')}</p>}
      </div>

      {chosen.length === 2 && <Comparison older={chosen[0]} newer={chosen[1]} />}

      <ul className="flex flex-col gap-3">
        {pitches.map((p) => {
          const { seconds, estimated } = pitchSeconds(p)
          const open = openId === p.id
          return (
            <li key={p.id} className="flex flex-col gap-6 rounded-card border border-border p-6">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-base font-semibold">{formatDate(p.createdAt, i18n.language, true)}</span>
                  <span className="text-sm text-text-muted">
                    {estimated && '~'}
                    {formatClock(seconds)}
                    {p.role && ` · ${p.role}`}
                    {' · '}
                    {p.feedback
                      ? t('pitch.average', { avg: formatNumber(pitchAverage(p.feedback), i18n.language) })
                      : t('pitch.notEvaluated')}
                  </span>
                </div>
                {pitches.length > 1 && (
                  <ToggleChip
                    selected={picked.includes(p.id)}
                    onSelectedChange={(on) =>
                      setPicked((cur) => (on ? [...cur.slice(-1), p.id] : cur.filter((x) => x !== p.id)))
                    }
                  >
                    {t('pitch.compare')}
                  </ToggleChip>
                )}
                <Button size="sm" variant="ghost" onClick={() => onOpen(open ? undefined : p.id)} aria-expanded={open}>
                  {open ? t('common.hide') : t('common.show')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 {...iconPropsSm} />}
                  aria-label={t('pitch.delete')}
                  onClick={() => setConfirmDelete(p)}
                />
              </div>
              {open &&
                (p.feedback ? (
                  <>
                    <div className="flex flex-col gap-2">
                      <h4 className="text-sm font-medium">{t('pitch.yourPitch')}</h4>
                      <p className="whitespace-pre-wrap text-reading">{p.transcript}</p>
                    </div>
                    <PitchFeedbackView pitch={p} feedback={p.feedback} />
                  </>
                ) : (
                  <p className="whitespace-pre-wrap text-reading">{p.transcript}</p>
                ))}
            </li>
          )
        })}
      </ul>

      <Dialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(undefined)}
        title={t('pitch.deleteTitle')}
        actions={
          <>
            <Button onClick={() => setConfirmDelete(undefined)}>{t('common.cancel')}</Button>
            <Button
              variant="danger"
              onClick={async () => {
                const id = confirmDelete!.id
                setConfirmDelete(undefined)
                setPicked((cur) => cur.filter((x) => x !== id))
                await getRepositories().pitches.remove(id)
              }}
            >
              {t('common.delete')}
            </Button>
          </>
        }
      >
        {t('pitch.deleteBody')}
      </Dialog>
    </section>
  )
}

export default function PitchPage() {
  const { t } = useTranslation()
  const pitches = usePitches()
  const [openId, setOpenId] = useState<string>()

  return (
    <>
      <PageHeader title={t('pitch.title')} description={t('pitch.description')} />
      <div className="flex flex-col gap-12">
        <Practice onSaved={setOpenId} />
        {pitches && pitches.length > 0 && <Versions pitches={pitches} openId={openId} onOpen={setOpenId} />}
      </div>
    </>
  )
}
