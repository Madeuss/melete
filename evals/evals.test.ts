import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { Fixture } from './fixtures'
import { compare } from './score'

const fixtures = z
  .array(Fixture)
  .parse(JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'answers.json'), 'utf8')))

describe('eval fixtures', () => {
  it('has 5 to 10 valid fixtures with unique ids', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(5)
    expect(fixtures.length).toBeLessThanOrEqual(10)
    expect(new Set(fixtures.map((f) => f.id)).size).toBe(fixtures.length)
  })
})

describe('compare', () => {
  const f = fixtures.find((x) => x.id === 'story-no-numbers')!
  const feedback = {
    star: { ...f.expected.star },
    clarity: f.expected.clarity,
    answeredTheQuestion: true,
    strengths: [],
    improvements: [],
    improvedAnswer: 'I proposed smaller PRs and review time dropped by 40% in 2 weeks.',
  }

  it('is perfect when scores match and flags invented numbers', () => {
    const c = compare(f, feedback)
    expect(c.mae).toBe(0)
    expect(c.withinTolerance).toBe(1)
    expect(c.answeredMatches).toBe(true)
    expect(c.inventedNumbers).toEqual(['40', '2'])
  })

  it('measures distance and tolerance', () => {
    const c = compare(f, { ...feedback, clarity: f.expected.clarity + 2, answeredTheQuestion: false, improvedAnswer: '' })
    expect(c.mae).toBeCloseTo(0.4)
    expect(c.withinTolerance).toBe(0.8)
    expect(c.answeredMatches).toBe(false)
    expect(c.inventedNumbers).toEqual([])
  })
})
