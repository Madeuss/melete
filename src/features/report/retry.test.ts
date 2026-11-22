import { beforeEach, expect, it } from 'vitest'
import type { Session, SessionConfig, Turn } from '../../schemas'
import { getRepositories } from '../../storage/repositories'
import { compareAnswers, startRetry } from './retry'

const turn = (scores: number[] | undefined, metrics: Partial<Turn['metrics']> = {}): Turn => ({
  id: 't',
  sessionId: 's',
  index: 0,
  kind: 'main',
  question: 'Tell me about a conflict.',
  transcript: '…',
  metrics: { fillerWords: {}, wordCount: 100, ...metrics },
  createdAt: '',
  ...(scores
    ? {
        feedback: {
          star: { situation: scores[0], task: scores[1], action: scores[2], result: scores[3] },
          clarity: scores[4],
          answeredTheQuestion: true,
          strengths: [],
          improvements: [],
          improvedAnswer: '',
        },
      }
    : {}),
})

it('puts the scores and metrics of both answers side by side', () => {
  const c = compareAnswers(
    turn([3, 2, 3, 1, 3], { wordCount: 180, wordsPerMinute: 150, fillerWords: { um: 4, like: 2 } }),
    turn([4, 4, 4, 4, 4], { wordCount: 140, wordsPerMinute: 135, fillerWords: { um: 1 } }),
  )
  expect(c.scores).toEqual([
    { key: 'situation', before: 3, after: 4 },
    { key: 'task', before: 2, after: 4 },
    { key: 'action', before: 3, after: 4 },
    { key: 'result', before: 1, after: 4 },
    { key: 'clarity', before: 3, after: 4 },
    { key: 'average', before: 2.4, after: 4 },
  ])
  expect(c.words).toEqual({ before: 180, after: 140 })
  expect(c.wordsPerMinute).toEqual({ before: 150, after: 135 })
  expect(c.fillers).toEqual({ before: 6, after: 1 })
})

it('leaves the scores empty for an answer not evaluated yet', () => {
  const c = compareAnswers(turn([3, 3, 3, 3, 3]), turn(undefined))
  expect(c.scores[0]).toEqual({ key: 'situation', before: 3, after: undefined })
})

beforeEach(async () => {
  await getRepositories().data.wipe()
})

it('starts an attempt with the same question, one question and no follow-ups', async () => {
  const config: SessionConfig = {
    type: 'behavioral',
    role: 'Frontend engineer',
    seniority: 'senior',
    questionCount: 5,
    followUps: true,
    feedbackTiming: 'end',
    difficulty: 'hard',
  }
  const original: Session = await getRepositories().sessions.create({
    config,
    model: 'old-model',
    language: 'en',
    status: 'finished',
    plannedQuestions: [{ text: 'Tell me about a conflict.', competency: 'conflict', storyId: 'st1' }],
  })
  const id = await startRetry(original, { ...turn([3, 3, 3, 3, 3]), id: 'turn-1', storyId: 'st1' }, 'new-model')
  const retry = await getRepositories().sessions.get(id)
  expect(retry).toMatchObject({
    model: 'new-model',
    status: 'in-progress',
    retryOf: { sessionId: original.id, turnId: 'turn-1' },
    plannedQuestions: [{ text: 'Tell me about a conflict.', competency: 'conflict', storyId: 'st1' }],
    config: { ...config, questionCount: 1, followUps: false, feedbackTiming: 'per-answer' },
  })
})
