import { z } from 'zod'
import { Feedback } from './feedback'

export const TurnMetrics = z.object({
  fillerWords: z.record(z.string(), z.number()),
  wordsPerMinute: z.number().optional(),
  wordCount: z.number(),
  /** Silences of 3 s or more while speaking (voice answers only). */
  pauses: z.object({ count: z.number().int().min(0), longestMs: z.number().min(0) }).optional(),
})
export type TurnMetrics = z.infer<typeof TurnMetrics>

/** Help the candidate used to understand the question (no such help in a real interview). */
export const ListeningAids = z.object({
  /** Times the question was heard again: the button or asking out loud. */
  repeats: z.number().int().min(0),
  /** Whether the blurred question text was revealed (hard difficulty only). */
  textShown: z.boolean(),
})
export type ListeningAids = z.infer<typeof ListeningAids>

export const Turn = z.object({
  id: z.string(),
  sessionId: z.string(),
  index: z.number().int(),
  kind: z.enum(['main', 'follow-up']),
  parentTurnId: z.string().optional(),
  question: z.string(),
  storyId: z.string().optional(),
  transcript: z.string(),
  answerDurationMs: z.number().optional(), // absent when typed
  metrics: TurnMetrics,
  feedback: Feedback.optional(),
  aids: ListeningAids.optional(),
  /** Words the user fixed in the transcript before sending: what speech recognition heard vs what they meant. */
  corrections: z.array(z.object({ heard: z.string(), meant: z.string() })).optional(),
  createdAt: z.string(),
})
export type Turn = z.infer<typeof Turn>
