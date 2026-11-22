/*
 * "Tell me about yourself": the opening pitch, practiced on its own. Timing and comparison rules
 * live here so the page only renders them.
 */
import { totalFillers } from './metrics'
import type { Pitch, PitchFeedback, PitchScores } from '../schemas'

/** The usual advice: long enough to say something, short enough to keep attention. */
export const PITCH_TARGET_SECONDS = { min: 60, max: 90 } as const

/** Typical conversational pace, to estimate how long a typed pitch would take to say. */
export const SPEAKING_WPM = 140

export type PitchTiming = 'short' | 'onTarget' | 'long'

/** 75 → "1:15". */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function pitchTiming(seconds: number): PitchTiming {
  if (seconds < PITCH_TARGET_SECONDS.min) return 'short'
  if (seconds > PITCH_TARGET_SECONDS.max) return 'long'
  return 'onTarget'
}

/** Measured duration when spoken; for a typed pitch, an estimate at a typical pace. */
export function pitchSeconds(pitch: Pick<Pitch, 'durationMs' | 'metrics'>): { seconds: number; estimated: boolean } {
  if (pitch.durationMs !== undefined) return { seconds: Math.round(pitch.durationMs / 1000), estimated: false }
  return { seconds: Math.round((pitch.metrics.wordCount / SPEAKING_WPM) * 60), estimated: true }
}

export const PITCH_SCORE_KEYS = ['structure', 'relevance', 'specificity', 'conciseness', 'clarity'] as const satisfies ReadonlyArray<
  keyof PitchScores
>

export function pitchAverage(feedback: PitchFeedback): number {
  const values = PITCH_SCORE_KEYS.map((k) => feedback.scores[k])
  return values.reduce((a, b) => a + b, 0) / values.length
}

export type PitchCompareKey = (typeof PITCH_SCORE_KEYS)[number] | 'average'

/** Two versions side by side (older first): scores, duration, pace and filler words. */
export function comparePitches(older: Pitch, newer: Pitch) {
  const scores = (p: Pitch): Partial<Record<PitchCompareKey, number>> =>
    p.feedback ? { ...p.feedback.scores, average: Math.round(pitchAverage(p.feedback) * 10) / 10 } : {}
  const a = scores(older)
  const b = scores(newer)
  const keys: PitchCompareKey[] = [...PITCH_SCORE_KEYS, 'average']
  return {
    scores: keys.map((key) => ({ key, before: a[key], after: b[key] })),
    seconds: { before: pitchSeconds(older), after: pitchSeconds(newer) },
    wordsPerMinute: { before: older.metrics.wordsPerMinute, after: newer.metrics.wordsPerMinute },
    fillers: { before: totalFillers(older.metrics.fillerWords), after: totalFillers(newer.metrics.fillerWords) },
  }
}
