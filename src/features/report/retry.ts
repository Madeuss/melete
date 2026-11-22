/*
 * "Answer again": a new attempt at one question of an earlier session, compared with the
 * original answer in its report.
 */
import { totalFillers } from '../../interview/metrics'
import { feedbackAverage, type Session, type Turn } from '../../schemas'
import { getRepositories } from '../../storage/repositories'

/**
 * Creates the attempt: the same question and interview settings, but a single question, no
 * follow-ups (so both answers are judged on their own) and feedback right after answering.
 * Returns the new session's id.
 */
export async function startRetry(original: Session, turn: Turn, model: string): Promise<string> {
  const planned = original.plannedQuestions.find((q) => q.text === turn.question)
  const session = await getRepositories().sessions.create({
    config: { ...original.config, questionCount: 1, followUps: false, feedbackTiming: 'per-answer' },
    model,
    language: original.language,
    status: 'in-progress',
    plannedQuestions: [
      {
        text: turn.question,
        competency: planned?.competency ?? '',
        ...(turn.storyId ? { storyId: turn.storyId } : {}),
      },
    ],
    retryOf: { sessionId: original.id, turnId: turn.id },
  })
  return session.id
}

export type CompareKey = 'situation' | 'task' | 'action' | 'result' | 'clarity' | 'average'

export interface Comparison {
  /** Scores 0–5 before and after; undefined when that answer has no feedback yet. */
  scores: Array<{ key: CompareKey; before?: number; after?: number }>
  words: { before: number; after: number }
  wordsPerMinute: { before?: number; after?: number }
  fillers: { before: number; after: number }
}

function scoresOf(turn: Turn): Partial<Record<CompareKey, number>> {
  const f = turn.feedback
  if (!f) return {}
  return { ...f.star, clarity: f.clarity, average: Math.round(feedbackAverage(f) * 10) / 10 }
}

/** Before (the original answer) and after (the new attempt), side by side. */
export function compareAnswers(before: Turn, after: Turn): Comparison {
  const b = scoresOf(before)
  const a = scoresOf(after)
  const keys: CompareKey[] = ['situation', 'task', 'action', 'result', 'clarity', 'average']
  return {
    scores: keys.map((key) => ({ key, before: b[key], after: a[key] })),
    words: { before: before.metrics.wordCount, after: after.metrics.wordCount },
    wordsPerMinute: { before: before.metrics.wordsPerMinute, after: after.metrics.wordsPerMinute },
    fillers: { before: totalFillers(before.metrics.fillerWords), after: totalFillers(after.metrics.fillerWords) },
  }
}
