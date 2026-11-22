import { z } from 'zod'
import { InterviewLanguage, Score } from '../src/schemas'

/**
 * An example answer with the score a careful human reviewer would give.
 * `tolerance` is how far (per score) a model can be and still count as agreeing.
 */
export const Fixture = z.object({
  id: z.string(),
  description: z.string(),
  interviewType: z.enum(['behavioral', 'technical', 'mixed']),
  language: InterviewLanguage,
  question: z.string(),
  competency: z.string().optional(),
  transcript: z.string(),
  /** Spoken answers have a duration (for words per minute); typed ones don't. */
  answerDurationMs: z.number().optional(),
  story: z
    .object({ title: z.string(), situation: z.string(), task: z.string(), action: z.string(), result: z.string() })
    .optional(),
  expected: z.object({
    star: z.object({ situation: Score, task: Score, action: Score, result: Score }),
    clarity: Score,
    answeredTheQuestion: z.boolean(),
  }),
  tolerance: z.number().default(1),
})
export type Fixture = z.infer<typeof Fixture>
