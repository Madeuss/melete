import { feedbackAverage, type Turn } from '../schemas'

/** Average of the per-answer averages (STAR + clarity), over evaluated turns. Computed in code. */
export function sessionAverage(turns: Turn[]): number | undefined {
  const scores = turns.filter((t) => t.feedback).map((t) => feedbackAverage(t.feedback!))
  if (scores.length === 0) return undefined
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

export interface ListeningSummary {
  /** Questions answered (main and follow-up). */
  questions: number
  /** Questions whose text was revealed. */
  textShown: number
  /** Times any question was heard again. */
  repeats: number
}

/** How much help the candidate needed to understand the questions. Turns saved before this existed count as none. */
export function listeningSummary(turns: Turn[]): ListeningSummary {
  return {
    questions: turns.length,
    textShown: turns.filter((t) => t.aids?.textShown).length,
    repeats: turns.reduce((n, t) => n + (t.aids?.repeats ?? 0), 0),
  }
}
