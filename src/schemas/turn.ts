import { z } from 'zod'
import { Feedback } from './feedback'

export const TurnMetrics = z.object({
  fillerWords: z.record(z.string(), z.number()),
  wordsPerMinute: z.number().optional(),
  wordCount: z.number(),
})
export type TurnMetrics = z.infer<typeof TurnMetrics>

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
  createdAt: z.string(),
})
export type Turn = z.infer<typeof Turn>
