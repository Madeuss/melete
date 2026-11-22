/*
 * Interview engine: the session state machine. It only knows the provider interfaces
 * (LlmProvider, SpeechToText, TextToSpeech) and the repositories, never concrete providers,
 * so tests run it with fakes and no network.
 *
 *   planning → asking → listening → reviewing → decidingFollowUp → (asking follow-up)
 *            → evaluating → showingFeedback → asking next … → summarizing → finished
 *   plus abandoned (user left) and error (a call failed; retry() re-runs the step).
 *
 * Every answer is saved as soon as it's submitted, so leaving or reloading loses nothing.
 */
import { isAbortError } from '../providers/llm/errors'
import type { LlmProvider } from '../providers/llm/types'
import { SttError, type SpeechToText } from '../providers/stt/types'
import type { TextToSpeech } from '../providers/tts/types'
import type { Feedback, PlannedQuestion, Session, Story, Turn, UiLanguage } from '../schemas'
import type { SessionsRepo, StoriesRepo, TurnsRepo } from '../storage/repositories'
import { callDecideFollowUp, callEvaluateAnswer, callPlanQuestions, callSummarizeSession } from './llmCalls'
import { computeMetrics } from './metrics'

export type EngineState =
  | 'idle'
  | 'planning'
  | 'asking'
  | 'listening'
  | 'reviewing'
  | 'decidingFollowUp'
  | 'evaluating'
  | 'showingFeedback'
  | 'summarizing'
  | 'finished'
  | 'abandoned'
  | 'error'

export interface CurrentQuestion {
  text: string
  kind: 'main' | 'follow-up'
  competency?: string
  storyId?: string
  parentTurnId?: string
}

export interface EngineSnapshot {
  state: EngineState
  session?: Session
  /** Index of the current main question (0-based). */
  questionIndex: number
  totalQuestions: number
  current?: CurrentQuestion
  /** True while the microphone is open. */
  recording: boolean
  /** Live transcript while recording. */
  partial: string
  /** Transcript under review, editable before sending. */
  draft: string
  /** Turns saved so far, in order. */
  turns: Turn[]
  /** Feedback for the question just answered (per-answer timing). */
  lastFeedback?: Array<{ turn: Turn; feedback: Feedback }>
  /** Progress of evaluations during summarizing (feedback at the end). */
  evaluationProgress?: { done: number; total: number }
  error?: unknown
  sttError?: SttError
}

export interface EngineDeps {
  llm: LlmProvider
  stt: SpeechToText
  tts: TextToSpeech
  repos: { sessions: SessionsRepo; turns: TurnsRepo; stories: StoriesRepo }
  /** Language for strengths/improvements/summary. */
  feedbackLanguage: UiLanguage
  now?: () => number
}

type Listener = () => void

export class InterviewEngine {
  private snap: EngineSnapshot = {
    state: 'idle',
    questionIndex: 0,
    totalQuestions: 0,
    recording: false,
    partial: '',
    draft: '',
    turns: [],
  }
  private readonly listeners = new Set<Listener>()
  private readonly deps: EngineDeps
  private readonly now: () => number
  private abort = new AbortController()
  private retryStep?: () => Promise<void>
  private recordingStartedAt?: number
  /** Duration of the voice answer under review; undefined for typed answers. */
  private answerDurationMs?: number
  private stories = new Map<string, Story>()

  constructor(deps: EngineDeps) {
    this.deps = deps
    this.now = deps.now ?? (() => Date.now())
  }

  // ── subscription (useSyncExternalStore) ──────────────────────────────

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): EngineSnapshot => this.snap

  private set(patch: Partial<EngineSnapshot>) {
    this.snap = { ...this.snap, ...patch }
    for (const l of this.listeners) l()
  }

  private get session(): Session {
    if (!this.snap.session) throw new Error('Engine has no session')
    return this.snap.session
  }

  private get stopped(): boolean {
    return this.abort.signal.aborted
  }

  // ── lifecycle ────────────────────────────────────────────────────────

  /**
   * Loads a session and continues from where it stopped: plans questions if there are none,
   * otherwise asks the next unanswered main question.
   */
  async open(sessionId: string): Promise<void> {
    const session = await this.deps.repos.sessions.get(sessionId)
    if (!session) throw new Error(`Session ${sessionId} not found`)
    const turns = await this.deps.repos.turns.listBySession(sessionId)
    this.set({ session, turns, totalQuestions: session.plannedQuestions.length })

    if (session.status === 'finished') return this.set({ state: 'finished' })
    if (session.status === 'abandoned') return this.set({ state: 'abandoned' })

    await this.loadStories()
    if (session.plannedQuestions.length === 0) return this.run(() => this.plan())

    const answeredMain = turns.filter((t) => t.kind === 'main').length
    if (answeredMain >= session.plannedQuestions.length) return this.run(() => this.summarize())
    return this.run(() => this.askMain(answeredMain))
  }

  /** User left the room: cancel whatever is running and mark the session abandoned. */
  async abandon(): Promise<void> {
    if (this.snap.state === 'finished' || this.snap.state === 'abandoned') return
    this.abort.abort()
    this.deps.tts.cancel()
    this.deps.stt.abort()
    this.set({ state: 'abandoned', recording: false })
    if (this.snap.session) await this.deps.repos.sessions.setStatus(this.snap.session.id, 'abandoned')
  }

  /** Re-runs the step that failed. */
  async retry(): Promise<void> {
    const step = this.retryStep
    if (this.snap.state !== 'error' || !step) return
    this.set({ error: undefined })
    await this.run(step)
  }

  /** Runs a step; on failure (other than cancellation) goes to `error` and remembers the step. */
  private async run(step: () => Promise<void>): Promise<void> {
    this.retryStep = step
    try {
      await step()
    } catch (err) {
      if (this.stopped || isAbortError(err)) return
      this.set({ state: 'error', error: err, recording: false })
    }
  }

  private async loadStories() {
    const ids = new Set(this.session.plannedQuestions.map((q) => q.storyId).filter((x): x is string => !!x))
    for (const id of ids) {
      const s = await this.deps.repos.stories.get(id)
      if (s) this.stories.set(id, s)
    }
  }

  // ── planning ─────────────────────────────────────────────────────────

  private async plan() {
    this.set({ state: 'planning' })
    const stories = await this.deps.repos.stories.list()
    const questions = await callPlanQuestions(
      this.deps.llm,
      {
        config: this.session.config,
        stories: stories.map((s) => ({ id: s.id, title: s.title, tags: s.tags })),
        language: this.session.language,
      },
      this.abort.signal,
    )
    if (this.stopped) return
    const session = await this.deps.repos.sessions.update(this.session.id, { plannedQuestions: questions })
    for (const s of stories) this.stories.set(s.id, s)
    this.set({ session, totalQuestions: questions.length })
    await this.askMain(0)
  }

  // ── asking ───────────────────────────────────────────────────────────

  private async askMain(index: number) {
    const q: PlannedQuestion = this.session.plannedQuestions[index]
    await this.ask(index, { text: q.text, kind: 'main', competency: q.competency, storyId: q.storyId })
  }

  private async ask(questionIndex: number, current: CurrentQuestion) {
    this.set({
      state: 'asking',
      questionIndex,
      current,
      draft: '',
      partial: '',
      lastFeedback: undefined,
      sttError: undefined,
    })
    this.answerDurationMs = undefined
    await this.deps.tts.speak(current.text)
    // While this one is answered, get the next main question's audio ready (follow-ups aren't known yet).
    this.deps.tts.prepare?.(this.session.plannedQuestions[questionIndex + 1]?.text ?? '')
    // The user may have skipped or left while the question was being spoken.
    if (!this.stopped && this.snap.state === 'asking') this.set({ state: 'listening' })
  }

  /** Stop speaking the question and go straight to answering. */
  skipQuestionAudio() {
    if (this.snap.state !== 'asking') return
    this.deps.tts.cancel()
    this.set({ state: 'listening' })
  }

  /** Speak the current question again. */
  async repeatQuestion() {
    const current = this.snap.current
    if (!current || (this.snap.state !== 'listening' && this.snap.state !== 'reviewing')) return
    this.deps.tts.cancel()
    await this.deps.tts.speak(current.text)
  }

  // ── answering ────────────────────────────────────────────────────────

  startRecording() {
    // Answering while the question is still being read skips the rest of the audio.
    if (this.snap.state === 'asking') this.skipQuestionAudio()
    if (this.snap.state !== 'listening' || this.snap.recording) return
    this.deps.tts.cancel()
    this.recordingStartedAt = this.now()
    this.set({ recording: true, partial: '', sttError: undefined })
    this.deps.stt.start(
      (text) => {
        if (this.snap.recording) this.set({ partial: text })
      },
      (err) => {
        this.recordingStartedAt = undefined
        this.set({ recording: false, sttError: err })
      },
    )
  }

  async stopRecording() {
    if (!this.snap.recording) return
    const started = this.recordingStartedAt
    this.set({ recording: false })
    const text = await this.deps.stt.stop()
    if (this.stopped) return
    this.answerDurationMs = started !== undefined ? this.now() - started : undefined
    this.recordingStartedAt = undefined
    this.set({ state: 'reviewing', draft: text || this.snap.partial, partial: '' })
  }

  /** Edits the transcript under review. */
  setDraft(text: string) {
    if (this.snap.state === 'asking') this.skipQuestionAudio()
    if (this.snap.state === 'reviewing' || this.snap.state === 'listening') this.set({ draft: text })
  }

  /** Discards the answer under review and goes back to answering. */
  retake() {
    if (this.snap.state !== 'reviewing') return
    this.answerDurationMs = undefined
    this.set({ state: 'listening', draft: '', partial: '' })
  }

  /**
   * Sends the answer. `typed` = written in the text box (no duration, so no words per minute).
   * The turn is saved immediately.
   */
  async submit(opts: { typed?: boolean } = {}) {
    const state = this.snap.state
    if (state !== 'reviewing' && state !== 'listening') return
    const transcript = this.snap.draft.trim()
    const current = this.snap.current
    if (!transcript || !current) return
    if (this.snap.recording) this.deps.stt.abort()

    const duration = opts.typed ? undefined : this.answerDurationMs
    const turn = await this.deps.repos.turns.add({
      sessionId: this.session.id,
      index: this.snap.turns.length,
      kind: current.kind,
      ...(current.parentTurnId ? { parentTurnId: current.parentTurnId } : {}),
      question: current.text,
      ...(current.storyId ? { storyId: current.storyId } : {}),
      transcript,
      ...(duration !== undefined ? { answerDurationMs: duration } : {}),
      metrics: computeMetrics(transcript, this.session.language, duration),
    })
    if (this.stopped) return
    this.set({ turns: [...this.snap.turns, turn], draft: '', recording: false })
    await this.run(() => this.afterAnswer(turn))
  }

  // ── after an answer ──────────────────────────────────────────────────

  private async afterAnswer(turn: Turn) {
    const { config } = this.session
    // At most one follow-up, and never after another follow-up.
    if (turn.kind === 'main' && config.followUps) {
      this.set({ state: 'decidingFollowUp' })
      const decision = await callDecideFollowUp(
        this.deps.llm,
        { question: turn.question, transcript: turn.transcript, language: this.session.language },
        this.abort.signal,
      )
      if (this.stopped) return
      if (decision.needsFollowUp && decision.followUp) {
        return this.ask(this.snap.questionIndex, {
          text: decision.followUp,
          kind: 'follow-up',
          competency: this.snap.current?.competency,
          storyId: turn.storyId,
          parentTurnId: turn.id,
        })
      }
    }

    if (config.feedbackTiming === 'per-answer') {
      this.set({ state: 'evaluating' })
      const group = this.currentGroup()
      const results: Array<{ turn: Turn; feedback: Feedback }> = []
      for (const t of group) {
        const feedback = t.feedback ?? (await this.evaluate(t))
        if (this.stopped) return
        results.push({ turn: { ...t, feedback }, feedback })
      }
      this.set({ state: 'showingFeedback', lastFeedback: results })
      return
    }

    await this.advance()
  }

  /** The main turn of the current question plus its follow-up, if any. */
  private currentGroup(): Turn[] {
    const turns = this.snap.turns
    const last = turns[turns.length - 1]
    if (!last) return []
    const mainId = last.kind === 'main' ? last.id : last.parentTurnId
    return turns.filter((t) => t.id === mainId || t.parentTurnId === mainId)
  }

  private async evaluate(turn: Turn): Promise<Feedback> {
    const parent = turn.parentTurnId ? this.snap.turns.find((t) => t.id === turn.parentTurnId) : undefined
    const story = turn.storyId ? this.stories.get(turn.storyId) : undefined
    const plannedIdx = this.session.plannedQuestions.findIndex((q) => q.text === (parent ?? turn).question)
    const feedback = await callEvaluateAnswer(
      this.deps.llm,
      {
        question: turn.question,
        competency: plannedIdx >= 0 ? this.session.plannedQuestions[plannedIdx].competency : undefined,
        transcript: turn.transcript,
        story,
        metrics: turn.metrics,
        previous: parent ? { question: parent.question, transcript: parent.transcript } : undefined,
        interviewType: this.session.config.type,
        language: this.session.language,
        feedbackLanguage: this.deps.feedbackLanguage,
      },
      this.abort.signal,
    )
    if (this.stopped) return feedback
    const saved = await this.deps.repos.turns.update(turn.id, { feedback })
    this.set({ turns: this.snap.turns.map((t) => (t.id === saved.id ? saved : t)) })
    return feedback
  }

  /** From showingFeedback: go to the next question (or the summary). */
  async next() {
    if (this.snap.state !== 'showingFeedback') return
    await this.run(() => this.advance())
  }

  private async advance() {
    const nextIndex = this.snap.questionIndex + 1
    if (nextIndex < this.session.plannedQuestions.length) return this.askMain(nextIndex)
    await this.summarize()
  }

  /** Ends early: evaluates what was answered and writes the summary. */
  async finishNow() {
    const allowed: EngineState[] = ['asking', 'listening', 'reviewing', 'showingFeedback']
    if (!allowed.includes(this.snap.state) || this.snap.turns.length === 0) return
    this.deps.tts.cancel()
    if (this.snap.recording) this.deps.stt.abort()
    await this.run(() => this.summarize())
  }

  // ── summary ──────────────────────────────────────────────────────────

  private async summarize() {
    const pending = this.snap.turns.filter((t) => !t.feedback)
    this.set({ state: 'summarizing', recording: false, evaluationProgress: { done: 0, total: pending.length } })
    let done = 0
    for (const t of pending) {
      await this.evaluate(t)
      if (this.stopped) return
      done++
      this.set({ evaluationProgress: { done, total: pending.length } })
    }

    const answers = this.snap.turns
      .filter((t): t is Turn & { feedback: Feedback } => !!t.feedback)
      .map((t) => ({ question: t.question, kind: t.kind, feedback: t.feedback }))
    const summary = await callSummarizeSession(
      this.deps.llm,
      { config: this.session.config, answers, feedbackLanguage: this.deps.feedbackLanguage },
      this.abort.signal,
    )
    if (this.stopped) return
    const session = await this.deps.repos.sessions.update(this.session.id, { summary, status: 'finished' })
    this.set({ state: 'finished', session, evaluationProgress: undefined })
  }
}
