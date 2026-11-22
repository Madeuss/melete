import { describe, expect, it } from 'vitest'
import type { Turn } from '../schemas'
import { sessionAverage } from './stats'

const turn = (scores?: number[]): Turn => ({
  id: 'x',
  sessionId: 's',
  index: 0,
  kind: 'main',
  question: 'q',
  transcript: 't',
  metrics: { fillerWords: {}, wordCount: 1 },
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

describe('sessionAverage', () => {
  it('averages evaluated turns only', () => {
    expect(sessionAverage([turn([5, 5, 5, 5, 5]), turn([1, 1, 1, 1, 1]), turn()])).toBe(3)
  })
  it('is undefined without evaluations', () => {
    expect(sessionAverage([turn()])).toBeUndefined()
    expect(sessionAverage([])).toBeUndefined()
  })
})
