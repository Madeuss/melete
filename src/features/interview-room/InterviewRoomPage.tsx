import { Keyboard, Loader2, Mic, Volume2, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { llmErrorMessage, sttErrorMessage } from '../../app/errors'
import { canUseVoice, createEngine, createMicLevelMeter } from '../../app/services'
import { useSettings } from '../../app/settingsContext'
import type { EngineSnapshot, InterviewEngine } from '../../interview/engine'
import { Button, Dialog, Logo, Notice, Progress, RecordButton, Textarea, buttonClasses, iconPropsSm } from '../../ui'
import { FeedbackView } from '../report/FeedbackView'

function Busy({ text, hint }: { text: string; hint?: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-16 text-center">
      <Loader2 size={24} strokeWidth={1.5} aria-hidden className="animate-spin text-text-muted" />
      <p className="text-base text-text">{text}</p>
      {hint && <p className="text-sm text-text-subtle">{hint}</p>}
    </div>
  )
}

/** Keeps a mic level (0..1) while recording, for the ring around the record button. */
function useMicLevel(active: boolean) {
  const [level, setLevel] = useState(0)
  useEffect(() => {
    if (!active) return
    const meter = createMicLevelMeter()
    meter.start(setLevel).catch(() => {}) // the meter is decoration; recognition has its own errors
    return () => {
      meter.stop()
      setLevel(0)
    }
  }, [active])
  return active ? level : 0
}

function Room({ engine, sessionId }: { engine: InterviewEngine; sessionId: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const ids = useId()
  const { settings } = useSettings()
  const s: EngineSnapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot)
  const voiceAvailable = canUseVoice(settings)
  const [mode, setMode] = useState<'voice' | 'typed'>(voiceAvailable ? 'voice' : 'typed')
  const [confirmLeave, setConfirmLeave] = useState(false)
  const level = useMicLevel(s.recording)
  const questionRef = useRef<HTMLHeadingElement>(null)

  // Move focus to each new question so screen readers announce it.
  useEffect(() => {
    if (s.state === 'asking') questionRef.current?.focus()
  }, [s.state, s.current?.text])

  // A recognition failure switches to typing, keeping the error visible.
  const effectiveMode = s.sttError ? 'typed' : mode

  useEffect(() => {
    if (s.state === 'finished') navigate(`/report/${sessionId}`, { replace: true })
  }, [s.state, navigate, sessionId])

  async function leave() {
    setConfirmLeave(false)
    await engine.abandon()
    navigate('/history')
  }

  const errorMessage = s.state === 'error' ? llmErrorMessage(t, s.error, settings.llm?.preset) : undefined
  const answering = s.state === 'asking' || s.state === 'listening' || s.state === 'reviewing'
  const isFollowUp = s.current?.kind === 'follow-up'
  const progressLabel = t('room.progress', { current: s.questionIndex + 1, total: s.totalQuestions })

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex items-center gap-4 border-b border-border px-4 py-3 sm:px-8">
        <Logo />
        <div className="mx-auto flex w-full max-w-xs flex-col gap-1.5">
          {s.totalQuestions > 0 && (
            <>
              <p className="text-center text-caption text-text-subtle">{progressLabel}</p>
              <Progress
                value={s.questionIndex + (s.state === 'showingFeedback' ? 1 : 0)}
                max={s.totalQuestions}
                label={progressLabel}
              />
            </>
          )}
        </div>
        <Button variant="ghost" size="sm" icon={<X {...iconPropsSm} />} onClick={() => setConfirmLeave(true)}>
          {t('room.leave')}
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-4 py-10 sm:px-8 sm:py-16">
        {s.state === 'planning' && <Busy text={t('room.planning')} hint={t('room.planningHint')} />}

        {s.state === 'error' && errorMessage && (
          <Notice
            tone="danger"
            title={errorMessage.title}
            action={
              <div className="flex flex-wrap gap-3">
                <Button variant="primary" size="sm" onClick={() => void engine.retry()}>
                  {t('common.tryAgain')}
                </Button>
                <Link to="/settings" className={buttonClasses('secondary', 'sm')}>
                  {t('room.openSettings')}
                </Link>
              </div>
            }
          >
            <p>{errorMessage.action}</p>
            {errorMessage.detail && <p className="mt-1 break-words text-caption">{errorMessage.detail}</p>}
          </Notice>
        )}

        {s.state === 'abandoned' && (
          <Notice
            title={t('room.abandoned')}
            action={
              <Link to={`/report/${sessionId}`} className={buttonClasses('secondary', 'sm')}>
                {t('room.toReport')}
              </Link>
            }
          />
        )}

        {s.current && (answering || s.state === 'decidingFollowUp' || s.state === 'evaluating') && (
          <section aria-labelledby={`${ids}-q`} className="flex flex-col gap-4">
            {isFollowUp && <p className="text-sm font-medium text-text-muted">{t('room.followUp')}</p>}
            <h1 id={`${ids}-q`} ref={questionRef} tabIndex={-1} className="text-xl outline-none sm:text-2xl">
              {s.current.text}
            </h1>
            {answering && (
              <div className="flex flex-wrap items-center gap-2">
                {s.state === 'asking' ? (
                  <>
                    <span className="text-sm text-text-subtle">{t('room.speaking')}</span>
                    <Button variant="ghost" size="sm" onClick={() => engine.skipQuestionAudio()}>
                      {t('room.skipAudio')}
                    </Button>
                  </>
                ) : (
                  settings.tts.kind === 'browser' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Volume2 {...iconPropsSm} />}
                      onClick={() => void engine.repeatQuestion()}
                      disabled={s.recording}
                    >
                      {t('room.repeat')}
                    </Button>
                  )
                )}
              </div>
            )}
          </section>
        )}

        {s.sttError && <Notice tone="warning" title={sttErrorMessage(t, s.sttError)} />}

        {/* Voice answer */}
        {(s.state === 'listening' || s.state === 'asking') && effectiveMode === 'voice' && (
          <section className="flex flex-col items-center gap-6">
            <RecordButton
              recording={s.recording}
              level={level}
              onClick={() => (s.recording ? void engine.stopRecording() : engine.startRecording())}
              label={s.recording ? t('room.stopRecording') : t('room.startRecording')}
            />
            <p className="text-sm text-text-muted" aria-live="polite">
              {s.recording ? t('room.recording') : t('room.tapToAnswer')}
            </p>
            {s.recording && (
              <div className="flex w-full flex-col gap-2">
                <span className="text-caption text-text-subtle">{t('room.liveTranscript')}</span>
                <p className="min-h-16 whitespace-pre-wrap text-reading text-text-muted">{s.partial || '…'}</p>
              </div>
            )}
            {!s.recording && (
              <Button variant="ghost" size="sm" icon={<Keyboard {...iconPropsSm} />} onClick={() => setMode('typed')}>
                {t('room.preferTyping')}
              </Button>
            )}
          </section>
        )}

        {/* Typed answer */}
        {(s.state === 'listening' || s.state === 'asking') && effectiveMode === 'typed' && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              void engine.submit({ typed: true })
            }}
          >
            <label htmlFor={`${ids}-typed`} className="text-sm font-medium">
              {t('room.yourAnswer')}
            </label>
            <Textarea
              id={`${ids}-typed`}
              reading
              rows={7}
              value={s.draft}
              placeholder={t('room.typePlaceholder')}
              onChange={(e) => engine.setDraft(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" variant="primary" disabled={!s.draft.trim()}>
                {t('room.send')}
              </Button>
              {voiceAvailable && !s.sttError && (
                <Button variant="ghost" icon={<Mic {...iconPropsSm} />} onClick={() => setMode('voice')}>
                  {t('room.preferSpeaking')}
                </Button>
              )}
            </div>
          </form>
        )}

        {/* Review before sending */}
        {s.state === 'reviewing' && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              void engine.submit()
            }}
          >
            <label htmlFor={`${ids}-review`} className="text-sm font-medium">
              {t('room.yourAnswer')}
            </label>
            <Textarea
              id={`${ids}-review`}
              reading
              rows={8}
              value={s.draft}
              onChange={(e) => engine.setDraft(e.target.value)}
              aria-describedby={`${ids}-review-hint`}
            />
            <p id={`${ids}-review-hint`} className="text-caption text-text-subtle">
              {s.draft.trim() ? t('room.reviewHint') : t('room.emptyTranscript')}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" variant="primary" disabled={!s.draft.trim()}>
                {t('room.send')}
              </Button>
              <Button onClick={() => engine.retake()}>{t('room.retake')}</Button>
            </div>
          </form>
        )}

        {s.state === 'decidingFollowUp' && <Busy text={t('room.deciding')} />}
        {s.state === 'evaluating' && <Busy text={t('room.evaluating')} />}
        {s.state === 'summarizing' && (
          <Busy
            text={
              s.evaluationProgress && s.evaluationProgress.done < s.evaluationProgress.total
                ? t('room.evaluatingProgress', {
                    done: s.evaluationProgress.done + 1,
                    total: s.evaluationProgress.total,
                  })
                : t('room.summarizing')
            }
          />
        )}

        {s.state === 'showingFeedback' && s.lastFeedback && (
          <section className="flex flex-col gap-8" aria-labelledby={`${ids}-fb`}>
            <h2 id={`${ids}-fb`} className="text-lg">
              {t('room.feedbackTitle')}
            </h2>
            {s.lastFeedback.map(({ turn, feedback }) => (
              <div key={turn.id} className="flex flex-col gap-4 border-t border-border pt-6 first:border-t-0 first:pt-0">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-text-muted">
                    {turn.kind === 'follow-up' ? t('room.followUp') : progressLabel}
                  </p>
                  <h3 className="text-lg">{turn.question}</h3>
                </div>
                <FeedbackView turn={turn} feedback={feedback} showAnswer />
              </div>
            ))}
            <div>
              <Button variant="primary" onClick={() => void engine.next()}>
                {s.questionIndex + 1 < s.totalQuestions ? t('room.next') : t('room.toReport')}
              </Button>
            </div>
          </section>
        )}

        {s.turns.length > 0 && (answering || s.state === 'showingFeedback') && !s.recording && (
          <div className="mt-auto border-t border-border pt-6">
            <Button variant="ghost" size="sm" onClick={() => void engine.finishNow()}>
              {t('room.finishNow')}
            </Button>
          </div>
        )}
      </main>

      <Dialog
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title={t('room.leaveTitle')}
        actions={
          <>
            <Button onClick={() => setConfirmLeave(false)}>{t('room.stay')}</Button>
            <Button variant="danger" onClick={() => void leave()}>
              {t('room.leave')}
            </Button>
          </>
        }
      >
        {t('room.leaveBody')}
      </Dialog>
    </div>
  )
}

export default function InterviewRoomPage() {
  const { t } = useTranslation()
  const { sessionId = '' } = useParams()
  const { settings } = useSettings()
  // One engine per room visit. useState keeps it across React StrictMode's dev double-mount.
  const [engine] = useState(() => createEngine(settings))
  const [notFound, setNotFound] = useState(false)
  const opened = useRef(false)
  const pendingAbandon = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    // StrictMode unmounts and remounts immediately in dev: cancel the abandon scheduled by that unmount.
    clearTimeout(pendingAbandon.current)
    if (!opened.current) {
      opened.current = true
      engine.open(sessionId).catch(() => setNotFound(true))
    }
    return () => {
      // Leaving the room any other way (browser back) cancels what's running and marks it abandoned.
      pendingAbandon.current = setTimeout(() => void engine.abandon(), 0)
    }
  }, [engine, sessionId])

  if (notFound)
    return (
      <div className="mx-auto max-w-2xl p-8">
        <Notice
          tone="warning"
          title={t('room.notFound')}
          action={
            <Link to="/history" className={buttonClasses('secondary', 'sm')}>
              {t('nav.history')}
            </Link>
          }
        />
      </div>
    )

  return <Room engine={engine} sessionId={sessionId} />
}
