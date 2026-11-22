import { feedbackAverage, type Turn } from '../schemas'

/** Average of the per-answer averages (STAR + clarity), over evaluated turns. Computed in code. */
export function sessionAverage(turns: Turn[]): number | undefined {
  const scores = turns.filter((t) => t.feedback).map((t) => feedbackAverage(t.feedback!))
  if (scores.length === 0) return undefined
  return scores.reduce((a, b) => a + b, 0) / scores.length
}
