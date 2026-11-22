import { describe, expect, it } from 'vitest'
import { computeMetrics, countFillerWords, countWords, totalFillers, wordsPerMinute } from './metrics'

describe('countWords', () => {
  it('counts words, keeping contractions and hyphenated words whole', () => {
    expect(countWords("I don't think the e-mail flow was the issue.")).toBe(9)
  })
  it('handles accents, numbers and punctuation', () => {
    expect(countWords('Então, reduzi a latência em 40% — de 800ms pra 480ms.')).toBe(10)
  })
  it('is zero for empty or whitespace-only text', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('   \n ')).toBe(0)
  })
})

describe('countFillerWords (en)', () => {
  it('counts single and multi-word fillers case-insensitively', () => {
    const t = 'Um, so basically I, like, you know, kind of led it. Uh I mean, it was Basically fine. Umm.'
    expect(countFillerWords(t, 'en')).toEqual({
      um: 2,
      uh: 1,
      like: 1,
      'you know': 1,
      basically: 2,
      'kind of': 1,
      'I mean': 1,
    })
  })
  it('does not match inside other words', () => {
    expect(countFillerWords('umbrella, likely, actuallyness, unlike, sorted often', 'en')).toEqual({})
  })
  it('matches across extra spaces in phrases', () => {
    expect(countFillerWords('sort   of', 'en')).toEqual({ 'sort of': 1 })
  })
})

describe('countFillerWords (pt)', () => {
  it('counts Portuguese fillers with accents', () => {
    const t = 'Então, tipo, aí eu fiz o deploy, né? Ééé basicamente isso. Aí deu certo.'
    expect(countFillerWords(t, 'pt')).toEqual({ então: 1, tipo: 1, aí: 2, né: 1, éé: 1, basicamente: 1 })
  })
  it('does not match "aí" inside "saída" or "né" inside "nébula" or a single "é"', () => {
    expect(countFillerWords('A saída da nébula é boa', 'pt')).toEqual({})
  })
})

describe('totalFillers', () => {
  it('sums counts', () => {
    expect(totalFillers({ um: 2, like: 3 })).toBe(5)
    expect(totalFillers({})).toBe(0)
  })
})

describe('wordsPerMinute', () => {
  it('is wordCount / minutes, rounded', () => {
    expect(wordsPerMinute(150, 60_000)).toBe(150)
    expect(wordsPerMinute(100, 45_000)).toBe(133)
  })
  it('is undefined without a duration (typed answers)', () => {
    expect(wordsPerMinute(100, undefined)).toBeUndefined()
    expect(wordsPerMinute(100, 0)).toBeUndefined()
  })
})

describe('computeMetrics', () => {
  it('combines everything for a spoken answer', () => {
    expect(computeMetrics('Um I led the migration', 'en', 30_000)).toEqual({
      fillerWords: { um: 1 },
      wordCount: 5,
      wordsPerMinute: 10,
    })
  })
  it('omits wordsPerMinute for typed answers', () => {
    expect(computeMetrics('I led it', 'en')).toEqual({ fillerWords: {}, wordCount: 3 })
  })
})
