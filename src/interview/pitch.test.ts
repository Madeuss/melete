import { describe, expect, it } from 'vitest'
import type { Pitch } from '../schemas'
import { comparePitches, formatClock, pitchAverage, pitchSeconds, pitchTiming } from './pitch'

const pitch = (opts: { durationMs?: number; words?: number; scores?: number[]; fillers?: Record<string, number> }): Pitch => ({
  id: 'p',
  createdAt: '',
  language: 'en',
  transcript: '…',
  ...(opts.durationMs !== undefined ? { durationMs: opts.durationMs } : {}),
  metrics: { wordCount: opts.words ?? 150, fillerWords: opts.fillers ?? {} },
  ...(opts.scores
    ? {
        feedback: {
          scores: {
            structure: opts.scores[0],
            relevance: opts.scores[1],
            specificity: opts.scores[2],
            conciseness: opts.scores[3],
            clarity: opts.scores[4],
          },
          strengths: [],
          improvements: [],
          improvedVersion: '',
        },
      }
    : {}),
})

describe('pitch timing', () => {
  it('compares the duration with the 60–90 second target', () => {
    expect(pitchTiming(45)).toBe('short')
    expect(pitchTiming(60)).toBe('onTarget')
    expect(pitchTiming(90)).toBe('onTarget')
    expect(pitchTiming(91)).toBe('long')
  })

  it('uses the measured time when spoken and estimates it at 140 wpm when typed', () => {
    expect(pitchSeconds(pitch({ durationMs: 74_600 }))).toEqual({ seconds: 75, estimated: false })
    expect(pitchSeconds(pitch({ words: 175 }))).toEqual({ seconds: 75, estimated: true })
  })

  it('formats seconds as a clock', () => {
    expect(formatClock(75)).toBe('1:15')
    expect(formatClock(5)).toBe('0:05')
  })
})

describe('comparing versions', () => {
  it('puts scores, time and filler words of two versions side by side', () => {
    const c = comparePitches(
      pitch({ durationMs: 120_000, scores: [2, 2, 1, 1, 3], fillers: { um: 5 } }),
      pitch({ durationMs: 80_000, scores: [4, 4, 3, 5, 4], fillers: { um: 1 } }),
    )
    expect(c.scores.at(-1)).toEqual({ key: 'average', before: 1.8, after: 4 })
    expect(c.seconds.before.seconds).toBe(120)
    expect(c.seconds.after.seconds).toBe(80)
    expect(c.fillers).toEqual({ before: 5, after: 1 })
  })

  it('averages the five scores', () => {
    expect(pitchAverage(pitch({ scores: [5, 4, 3, 2, 1] }).feedback!)).toBe(3)
  })
})
