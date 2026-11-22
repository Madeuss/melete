import type { Feedback } from '../src/schemas'
import type { Fixture } from './fixtures'

const KEYS = ['situation', 'task', 'action', 'result'] as const

export interface Comparison {
  /** Mean absolute error over the 5 scores. */
  mae: number
  /** Share of the 5 scores within tolerance. */
  withinTolerance: number
  answeredMatches: boolean
  /** Numbers in improvedAnswer that appear neither in the transcript nor in the story. */
  inventedNumbers: string[]
}

function numbersIn(text: string): string[] {
  return text.match(/\d+(?:[.,]\d+)?/g) ?? []
}

/** Compares a model's feedback with the fixture's expected scores. Pure, unit-tested. */
export function compare(fixture: Fixture, fb: Feedback): Comparison {
  const pairs: Array<[number, number]> = [
    ...KEYS.map((k) => [fb.star[k], fixture.expected.star[k]] as [number, number]),
    [fb.clarity, fixture.expected.clarity],
  ]
  const diffs = pairs.map(([a, b]) => Math.abs(a - b))
  const source = [fixture.transcript, ...Object.values(fixture.story ?? {})].join(' ')
  const known = new Set(numbersIn(source))
  return {
    mae: diffs.reduce((a, b) => a + b, 0) / diffs.length,
    withinTolerance: diffs.filter((d) => d <= fixture.tolerance).length / diffs.length,
    answeredMatches: fb.answeredTheQuestion === fixture.expected.answeredTheQuestion,
    inventedNumbers: numbersIn(fb.improvedAnswer).filter((n) => !known.has(n)),
  }
}
