import { z } from 'zod'
import { Feedback } from './feedback'

export const TurnMetrics = z.object({
  fillerWords: z.record(z.string(), z.number()),
  wordsPerMinute: z.number().optional(),
  wordCount: z.number(),
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
  createdAt: z.string(),
})
export type Turn = z.infer<typeof Turn>
