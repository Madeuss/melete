import { describe, expect, it } from 'vitest'
import type { Turn } from '../schemas'
import { corrections, fluencySummary, summarizePauses } from './fluency'

describe('corrections', () => {
  it('finds the words the user replaced, ignoring case and punctuation fixes', () => {
    expect(corrections('i lead the migration to react and fixed the cash', 'I led the migration to React, and fixed the cache.')).toEqual([
      { heard: 'lead', meant: 'led' },
      { heard: 'cash', meant: 'cache' },
    ])
  })

  it('keeps multi-word replacements together and ignores pure additions or deletions', () => {
    expect(corrections('we used cooper netties for it', 'we used Kubernetes for it')).toEqual([
      { heard: 'cooper netties', meant: 'kubernetes' },
    ])
    expect(corrections('it was fast', 'it was really fast')).toEqual([])
    expect(corrections('it was um fast', 'it was fast')).toEqual([])
  })
})

describe('summarizePauses', () => {
  it('counts only silences of 3 seconds or more', () => {
    expect(summarizePauses([400, 3000, 1200, 5200])).toEqual({ count: 2, longestMs: 5200 })
    expect(summarizePauses([800])).toEqual({ count: 0, longestMs: 0 })
  })
})

const turn = (id: string, transcript: string, extra: Partial<Turn> = {}): Turn => ({
  id,
  sessionId: 's',
  index: 0,
  kind: 'main',
  question: 'q',
  transcript,
  metrics: { fillerWords: {}, wordCount: transcript.split(' ').length },
  createdAt: '',
  ...extra,
})

describe('fluencySummary', () => {
  it('flags words misheard in more than one answer as a pronunciation hint', () => {
    const f = fluencySummary([
      turn('a', 'x', { corrections: [{ heard: 'cash', meant: 'cache' }] }),
      turn('b', 'x', { corrections: [{ heard: 'catch', meant: 'cache' }, { heard: 'lead', meant: 'led' }] }),
    ])
    expect(f.pronunciation).toEqual([{ word: 'cache', answers: 2, heardAs: ['cash', 'catch'] }])
    expect(f.corrected).toBe(3)
  })

  it('adds up pauses over spoken answers only', () => {
    const f = fluencySummary([
      turn('a', 'x', { metrics: { fillerWords: {}, wordCount: 1, pauses: { count: 2, longestMs: 4000 } } }),
      turn('b', 'x', { metrics: { fillerWords: {}, wordCount: 1, pauses: { count: 1, longestMs: 6500 } } }),
      turn('c', 'typed answer'),
    ])
    expect(f.pauses).toEqual({ answers: 2, count: 3, longestMs: 6500 })
  })

  it('lists content words used four times or more, leaving out common ones', () => {
    const f = fluencySummary([
      turn('a', 'The project was very important and the team said the project was important.'),
      turn('b', 'An important project, really important for the project team.'),
    ])
    expect(f.repeated).toEqual([
      { word: 'important', count: 4 },
      { word: 'project', count: 4 },
    ])
  })
})
