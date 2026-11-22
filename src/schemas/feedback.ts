import { z } from 'zod'

export const Score = z.number().int().min(0).max(5)
export type Score = z.infer<typeof Score>

export const Feedback = z.object({
  star: z.object({ situation: Score, task: Score, action: Score, result: Score }),
  clarity: Score,
  answeredTheQuestion: z.boolean(),
  strengths: z.array(z.string()).max(3),
  improvements: z.array(z.string()).max(3),
  improvedAnswer: z.string(), // same story, better told, in the interview language
})
export type Feedback = z.infer<typeof Feedback>

export const SessionSummary = z.object({
  overall: Score,
  topStrengths: z.array(z.string()).max(3),
  focusNext: z.array(z.string()).max(3),
})
export type SessionSummary = z.infer<typeof SessionSummary>

/** Average of the 5 scores of one answer (STAR + clarity), 0..5. */
export function feedbackAverage(f: Feedback): number {
  const { situation, task, action, result } = f.star
  return (situation + task + action + result + f.clarity) / 5
}
