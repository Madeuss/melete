import { z } from 'zod'
import { InterviewLanguage } from './settings'
import { Score } from './feedback'
import { TurnMetrics } from './turn'

/** What a strong "Tell me about yourself" is judged on, each 0–5. */
export const PitchScores = z.object({
  /** Present → past → future (who you are now, what you did, why this role). */
  structure: Score,
  /** Tailored to the role, not a recital of the CV. */
  relevance: Score,
  /** Concrete achievements and results, not adjectives. */
  specificity: Score,
  /** Fits in about 60–90 seconds without rushing. */
  conciseness: Score,
  clarity: Score,
})
export type PitchScores = z.infer<typeof PitchScores>

export const PitchFeedback = z.object({
  scores: PitchScores,
  strengths: z.array(z.string()).max(3),
  improvements: z.array(z.string()).max(3),
  /** A tighter version using only facts from the transcript; placeholders like [metric] for gaps. */
  improvedVersion: z.string(),
})
export type PitchFeedback = z.infer<typeof PitchFeedback>

/** One saved version of the pitch. */
export const Pitch = z.object({
  id: z.string(),
  createdAt: z.string(),
  language: InterviewLanguage,
  /** The role it was practiced for, if given (it changes what "relevant" means). */
  role: z.string().optional(),
  transcript: z.string(),
  /** Absent when typed. */
  durationMs: z.number().optional(),
  metrics: TurnMetrics,
  feedback: PitchFeedback.optional(),
})
export type Pitch = z.infer<typeof Pitch>
