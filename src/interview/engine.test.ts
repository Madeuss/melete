import { afterEach, describe, expect, it } from 'vitest'
import { LlmError } from '../providers/llm/errors'
import { FakeLlm } from '../providers/fakes/FakeLlm'
import { FakeStt } from '../providers/fakes/FakeStt'
import { FakeTts } from '../providers/fakes/FakeTts'
import type { ChatMessage } from '../providers/llm/types'
import { SttError } from '../providers/stt/types'
import type { SessionConfig } from '../schemas'
import { MeleteDb } from '../storage/db'
import { createRepositories } from '../storage/repositories'
import { InterviewEngine, type EngineState } from './engine'

const dbs: MeleteDb[] = []
afterEach(async () => {
  await Promise.all(dbs.splice(0).map((db) => db.delete()))
})

const baseConfig: SessionConfig = {
  type: 'behavioral',
  role: 'Frontend engineer',
  seniority: 'senior',
  questionCount: 2,
  followUps: true,
  feedbackTiming: 'per-answer',
  difficulty: 'standard',
}

const feedback = (score: number) =>
  JSON.stringify({
    star: { situation: score, task: score, action: score, result: score },
    clarity: score,
    answeredTheQuestion: true,
    strengths: ['Specific'],
    improvements: ['Add a number'],
    improvedAnswer: 'Better answer with [metric].',
  })

type Kind = 'plan' | 'classify' | 'followUp' | 'evaluate' | 'summary'

function kindOf(messages: ChatMessage[]): Kind {
  const system = messages[0].content
  if (system.includes('Plan exactly')) return 'plan'
  if (system.includes('the candidate said something short')) return 'classify'
  if (system.includes('Decide whether one follow-up')) return 'followUp'
  if (system.includes('evaluating one answer')) return 'evaluate'
  if (system.includes('summary of a mock interview')) return 'summary'
  throw new Error('unknown call')
}

/** A FakeLlm that answers each kind of call; followUps decides per main transcript. */
function scriptedLlm(opts: { followUpFor?: string[] } = {}) {
  const llm = new FakeLlm([], { supportsJsonObject: true })
  return llm.route((messages) => {
    switch (kindOf(messages)) {
      case 'plan':
        return JSON.stringify({
          questions: [
            { text: 'Tell me about a conflict.', competency: 'conflict', storyId: 'missing-id' },
            { text: 'Tell me about a failure.', competency: 'failure' },
          ],
        })
      case 'classify':
        // "what was it" stands for a repeat request the local patterns don't know.
        return JSON.stringify({ intent: messages[1].content.includes('what was it') ? 'repeat' : 'answer' })
      case 'followUp': {
        const transcript = messages[1].content
        const needs = (opts.followUpFor ?? []).some((t) => transcript.includes(t))
        return JSON.stringify(needs ? { needsFollowUp: true, followUp: 'What was the result?' } : { needsFollowUp: false })
      }
      case 'evaluate':
        return feedback(3)
      case 'summary':
        return JSON.stringify({ overall: 3, topStrengths: ['Ownership'], focusNext: ['Quantify results'] })
    }
  })
}

async function setup(config: Partial<SessionConfig> = {}, llm = scriptedLlm()) {
  const db = new MeleteDb(`engine-${crypto.randomUUID()}`)
  dbs.push(db)
  const repos = createRepositories(db)
  const session = await repos.sessions.create({
    config: { ...baseConfig, ...config },
    model: llm.model,
    language: 'en',
    status: 'in-progress',
    plannedQuestions: [],
  })
  const stt = new FakeStt()
  const tts = new FakeTts()
  let clock = 0
  const engine = new InterviewEngine({
    llm,
    stt,
    tts,
    repos,
    feedbackLanguage: 'en',
    now: () => clock,
  })
  const states: EngineState[] = []
  engine.subscribe(() => {
    const s = engine.getSnapshot().state
    if (states.at(-1) !== s) states.push(s)
  })
  return {
    engine,
    repos,
    session,
    llm,
    stt,
    tts,
    states,
    advanceClock: (ms: number) => (clock += ms),
    kinds: () => llm.calls.map((c) => kindOf(c.messages)),
  }
}

async function typeAnswer(engine: InterviewEngine, text: string) {
  engine.setDraft(text)
  await engine.submit({ typed: true })
}

async function sayAnswer(t: { engine: InterviewEngine; stt: FakeStt }, text: string) {
  t.stt.transcript = text
  t.engine.startRecording()
  await t.engine.stopRecording()
  await t.engine.submit()
}

describe('InterviewEngine', () => {
  it('runs a full per-answer session with one follow-up', async () => {
    const t = await setup({}, scriptedLlm({ followUpFor: ['talked to them'] }))
    await t.engine.open(t.session.id)

    let s = t.engine.getSnapshot()
    expect(s.state).toBe('listening')
    expect(s.totalQuestions).toBe(2)
    expect(t.tts.spoken).toEqual(['Tell me about a conflict.'])

    await typeAnswer(t.engine, 'I talked to them.')
    s = t.engine.getSnapshot()
    expect(s.state).toBe('listening')
    expect(s.current).toMatchObject({ kind: 'follow-up', text: 'What was the result?' })

    await typeAnswer(t.engine, 'We shipped on time.')
    s = t.engine.getSnapshot()
    expect(s.state).toBe('showingFeedback')
    expect(s.lastFeedback).toHaveLength(2) // main + follow-up

    await t.engine.next()
    expect(t.engine.getSnapshot().current?.text).toBe('Tell me about a failure.')
    await typeAnswer(t.engine, 'I missed a deadline and owned it, we cut scope.')
    expect(t.engine.getSnapshot().state).toBe('showingFeedback')

    await t.engine.next()
    s = t.engine.getSnapshot()
    expect(s.state).toBe('finished')
    expect(s.session?.status).toBe('finished')
    expect(s.session?.summary?.overall).toBe(3)

    expect(t.states).toEqual([
      'idle', // session loaded
      'planning',
      'asking',
      'listening',
      'decidingFollowUp',
      'asking',
      'listening',
      'evaluating',
      'showingFeedback',
      'asking',
      'listening',
      'decidingFollowUp',
      'evaluating',
      'showingFeedback',
      'summarizing',
      'finished',
    ])
    expect(t.kinds()).toEqual(['plan', 'followUp', 'evaluate', 'evaluate', 'followUp', 'evaluate', 'summary'])

    const turns = await t.repos.turns.listBySession(t.session.id)
    expect(turns.map((x) => [x.index, x.kind])).toEqual([
      [0, 'main'],
      [1, 'follow-up'],
      [2, 'main'],
    ])
    expect(turns[1].parentTurnId).toBe(turns[0].id)
    expect(turns.every((x) => x.feedback)).toBe(true)
    // Unknown story ids from the model are dropped.
    expect((await t.repos.sessions.get(t.session.id))?.plannedQuestions[0].storyId).toBeUndefined()
  })

  it('records every LLM call of the session with its kind and token usage', async () => {
    const llm = scriptedLlm({ followUpFor: ['talked to them'] })
    llm.usage = { promptTokens: 100, completionTokens: 20 }
    const t = await setup({ questionCount: 1 }, llm)
    await t.engine.open(t.session.id)
    await typeAnswer(t.engine, 'I talked to them.')
    await typeAnswer(t.engine, 'We shipped on time.')
    await t.engine.next()
    expect(t.engine.getSnapshot().state).toBe('finished')

    const calls = await t.repos.llmCalls.listBySession(t.session.id)
    expect(calls.map((c) => c.kind)).toEqual([
      'planQuestions',
      'decideFollowUp',
      'evaluateAnswer',
      'evaluateAnswer',
      'summarizeSession',
    ])
    expect(calls.every((c) => c.model === 'fake-model' && c.usage?.promptTokens === 100)).toBe(true)
  })

  it('still records the calls when the provider reports no usage', async () => {
    const t = await setup({ questionCount: 1, followUps: false, feedbackTiming: 'end' })
    await t.engine.open(t.session.id)
    await typeAnswer(t.engine, 'An answer.')
    const calls = await t.repos.llmCalls.listBySession(t.session.id)
    expect(calls.map((c) => c.kind)).toEqual(['planQuestions', 'evaluateAnswer', 'summarizeSession'])
    expect(calls.every((c) => c.usage === undefined)).toBe(true)
  })

  it('with feedback at the end, evaluates everything before the summary', async () => {
    const t = await setup({ feedbackTiming: 'end', followUps: false })
    await t.engine.open(t.session.id)
    await typeAnswer(t.engine, 'First answer.')
    expect(t.engine.getSnapshot().current?.text).toBe('Tell me about a failure.')
    await typeAnswer(t.engine, 'Second answer.')

    expect(t.engine.getSnapshot().state).toBe('finished')
    expect(t.kinds()).toEqual(['plan', 'evaluate', 'evaluate', 'summary'])
    expect(t.states).not.toContain('evaluating')
    expect(t.states).not.toContain('decidingFollowUp')
  })

  it('never asks a follow-up after a follow-up', async () => {
    const t = await setup({ questionCount: 1 }, scriptedLlm({ followUpFor: ['vague'] }))
    await t.engine.open(t.session.id)
    await typeAnswer(t.engine, 'Something vague.')
    expect(t.engine.getSnapshot().current?.kind).toBe('follow-up')
    await typeAnswer(t.engine, 'Still vague.')
    expect(t.engine.getSnapshot().state).toBe('showingFeedback')
    expect(t.kinds().filter((k) => k === 'followUp')).toHaveLength(1)
  })

  it('measures voice answers for words per minute and lets the user edit before sending', async () => {
    const t = await setup({ followUps: false, feedbackTiming: 'end' })
    await t.engine.open(t.session.id)
    t.stt.transcript = 'um I led the migration to react'
    t.engine.startRecording()
    expect(t.engine.getSnapshot().recording).toBe(true)
    t.stt.emitPartial('um I led')
    expect(t.engine.getSnapshot().partial).toBe('um I led')
    t.advanceClock(3_500)
    await t.engine.stopRecording()

    let s = t.engine.getSnapshot()
    expect(s.state).toBe('reviewing')
    expect(s.draft).toBe('um I led the migration to react')
    t.engine.setDraft('Um, I led the migration to React.')
    await t.engine.submit()

    const [turn] = await t.repos.turns.listBySession(t.session.id)
    expect(turn.transcript).toBe('Um, I led the migration to React.')
    expect(turn.answerDurationMs).toBe(3_500)
    expect(turn.metrics.wordCount).toBe(7)
    expect(turn.metrics.wordsPerMinute).toBe(120)
    expect(turn.metrics.fillerWords).toEqual({ um: 1 })
    s = t.engine.getSnapshot()
    expect(s.current?.text).toBe('Tell me about a failure.')
  })

  it('repeats the question when asked out loud, without saving that as an answer', async () => {
    const t = await setup({ followUps: false, feedbackTiming: 'end' })
    await t.engine.open(t.session.id)
    await sayAnswer(t, 'Sorry, could you repeat the question?')

    expect(t.engine.getSnapshot()).toMatchObject({ state: 'listening', draft: '' })
    expect(t.engine.getSnapshot().current?.text).toBe('Tell me about a conflict.')
    expect(t.tts.spoken.at(-1)).toBe('Sure, let me repeat the question. Tell me about a conflict.')
    expect(await t.repos.turns.listBySession(t.session.id)).toHaveLength(0)
    expect(t.kinds()).toEqual(['plan']) // a common phrasing needs no model call

    await sayAnswer(t, 'I disagreed with a teammate about the API design and we ran a spike to compare both options.')
    const [turn] = await t.repos.turns.listBySession(t.session.id)
    expect(turn.aids).toEqual({ repeats: 1, textShown: false })
  })

  it('asks the model about other short replies', async () => {
    const t = await setup({ followUps: false, feedbackTiming: 'end' })
    await t.engine.open(t.session.id)
    await sayAnswer(t, 'hmm what was it')
    expect(t.engine.getSnapshot().state).toBe('listening')
    expect(await t.repos.turns.listBySession(t.session.id)).toHaveLength(0)

    await sayAnswer(t, 'I never had a conflict')
    expect(await t.repos.turns.listBySession(t.session.id)).toHaveLength(1)
    expect(t.kinds()).toEqual(['plan', 'classify', 'classify'])
  })

  it('treats a short reply as an answer when the check fails, and never checks typed answers', async () => {
    const llm = scriptedLlm()
    const t = await setup({ followUps: false, feedbackTiming: 'end' }, llm)
    await t.engine.open(t.session.id)
    await typeAnswer(t.engine, 'Could you repeat?')
    expect(await t.repos.turns.listBySession(t.session.id)).toHaveLength(1)

    llm.route(() => {
      throw new LlmError('network')
    })
    await sayAnswer(t, 'I failed once')
    expect(await t.repos.turns.listBySession(t.session.id)).toHaveLength(2)
  })

  it('records revealing the text and hearing the question again, per question', async () => {
    const t = await setup({ followUps: false, feedbackTiming: 'end', difficulty: 'hard' })
    await t.engine.open(t.session.id)
    expect(t.engine.getSnapshot().questionRevealed).toBe(false)
    t.engine.revealQuestionText()
    expect(t.engine.getSnapshot().questionRevealed).toBe(true)
    await t.engine.repeatQuestion()
    await t.engine.repeatQuestion()
    await typeAnswer(t.engine, 'First answer.')

    expect(t.engine.getSnapshot().questionRevealed).toBe(false) // next question starts hidden again
    await typeAnswer(t.engine, 'Second answer.')
    const turns = await t.repos.turns.listBySession(t.session.id)
    expect(turns.map((x) => x.aids)).toEqual([
      { repeats: 2, textShown: true },
      { repeats: 0, textShown: false },
    ])
  })

  it('typed answers have no words per minute', async () => {
    const t = await setup({ followUps: false, feedbackTiming: 'end' })
    await t.engine.open(t.session.id)
    await typeAnswer(t.engine, 'I led it.')
    const [turn] = await t.repos.turns.listBySession(t.session.id)
    expect(turn.answerDurationMs).toBeUndefined()
    expect(turn.metrics.wordsPerMinute).toBeUndefined()
  })

  it('retake discards the reviewed answer', async () => {
    const t = await setup()
    await t.engine.open(t.session.id)
    t.stt.transcript = 'bad take'
    t.engine.startRecording()
    await t.engine.stopRecording()
    t.engine.retake()
    expect(t.engine.getSnapshot()).toMatchObject({ state: 'listening', draft: '' })
  })

  it('keeps listening and reports when speech recognition fails', async () => {
    const t = await setup()
    await t.engine.open(t.session.id)
    t.engine.startRecording()
    t.stt.emitError(new SttError('not-allowed'))
    const s = t.engine.getSnapshot()
    expect(s.state).toBe('listening')
    expect(s.recording).toBe(false)
    expect(s.sttError?.kind).toBe('not-allowed')
  })

  it('leaving cancels the running call, marks the session abandoned and keeps saved answers', async () => {
    const t = await setup({ questionCount: 2 }, scriptedLlm())
    await t.engine.open(t.session.id)
    t.llm.delayMs = 200
    t.engine.setDraft('My answer.')
    const pending = t.engine.submit({ typed: true }) // now waits on decideFollowUp
    await new Promise((r) => setTimeout(r, 20))
    expect(t.engine.getSnapshot().state).toBe('decidingFollowUp')

    await t.engine.abandon()
    await pending
    expect(t.engine.getSnapshot().state).toBe('abandoned')
    expect((await t.repos.sessions.get(t.session.id))?.status).toBe('abandoned')
    expect(await t.repos.turns.listBySession(t.session.id)).toHaveLength(1)
    expect(t.tts.cancelled).toBeGreaterThan(0)
    expect(t.stt.aborted).toBe(1)
    const callsAtAbandon = t.llm.calls.length
    await new Promise((r) => setTimeout(r, 250))
    expect(t.llm.calls.length).toBe(callsAtAbandon)
  })

  it('goes to error on a failed call and retries the same step', async () => {
    const llm = scriptedLlm()
    let failNext = true
    const original = llm.chat.bind(llm)
    llm.chat = async (messages, opts) => {
      if (failNext) {
        failNext = false
        throw new LlmError('rate-limit', { status: 429 })
      }
      return original(messages, opts)
    }
    const t = await setup({}, llm)
    await t.engine.open(t.session.id)
    const s = t.engine.getSnapshot()
    expect(s.state).toBe('error')
    expect((s.error as LlmError).kind).toBe('rate-limit')

    await t.engine.retry()
    expect(t.engine.getSnapshot().state).toBe('listening')
    expect(t.engine.getSnapshot().totalQuestions).toBe(2)
  })

  it('resumes a session at the next unanswered question', async () => {
    const t = await setup({ followUps: false })
    await t.repos.sessions.update(t.session.id, {
      plannedQuestions: [
        { text: 'Q1', competency: 'a' },
        { text: 'Q2', competency: 'b' },
      ],
    })
    await t.repos.turns.add({
      sessionId: t.session.id,
      index: 0,
      kind: 'main',
      question: 'Q1',
      transcript: 'answer',
      metrics: { fillerWords: {}, wordCount: 1 },
    })
    await t.engine.open(t.session.id)
    const s = t.engine.getSnapshot()
    expect(s.state).toBe('listening')
    expect(s.questionIndex).toBe(1)
    expect(s.current?.text).toBe('Q2')
    expect(t.kinds()).toEqual([]) // no re-planning
  })

  it('finishing early evaluates what was answered and summarizes', async () => {
    const t = await setup({ followUps: false, feedbackTiming: 'end', questionCount: 2 })
    await t.engine.open(t.session.id)
    await typeAnswer(t.engine, 'Only one answer.')
    await t.engine.finishNow()
    const s = t.engine.getSnapshot()
    expect(s.state).toBe('finished')
    expect(t.kinds()).toEqual(['plan', 'evaluate', 'summary'])
  })

  it('does not reopen finished or abandoned sessions', async () => {
    const t = await setup()
    await t.repos.sessions.setStatus(t.session.id, 'abandoned')
    await t.engine.open(t.session.id)
    expect(t.engine.getSnapshot().state).toBe('abandoned')
    expect(t.llm.calls).toHaveLength(0)
  })
})
