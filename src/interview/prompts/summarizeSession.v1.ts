import type { ChatMessage } from '../../providers/llm/types'
import { SessionSummary, type Feedback, type SessionConfig, type UiLanguage } from '../../schemas'
import { RUBRIC, UI_LANGUAGE_NAME } from './shared'

export interface SummarizeSessionInput {
  config: SessionConfig
  answers: Array<{ question: string; kind: 'main' | 'follow-up'; feedback: Feedback }>
  feedbackLanguage: UiLanguage
}

export const summarizeSessionV1 = {
  id: 'summarizeSession',
  version: 'v1',
  name: 'summarize_session',
  schema: SessionSummary,

  build({ config, answers, feedbackLanguage }: SummarizeSessionInput): ChatMessage[] {
    const system = [
      'You are an interview coach writing the summary of a mock interview session.',
      'You receive the structured feedback already given for each answer. Base the summary only on it.',
      '',
      RUBRIC,
      '',
      'overall is one 0–5 score for the whole session with that rubric, weighing main answers more than follow-ups.',
      'topStrengths: up to 3 patterns that showed up across answers.',
      'focusNext: up to 3 concrete things to practice next, most important first.',
      `Write topStrengths and focusNext in ${UI_LANGUAGE_NAME[feedbackLanguage]}, short and specific. No generic advice.`,
    ].join('\n')

    const user = [
      `Session: ${config.type} interview for a ${config.seniority} ${config.role}.`,
      ...answers.map((a, i) =>
        [
          `Answer ${i + 1} (${a.kind}) — question: ${a.question}`,
          JSON.stringify({
            star: a.feedback.star,
            clarity: a.feedback.clarity,
            answeredTheQuestion: a.feedback.answeredTheQuestion,
            strengths: a.feedback.strengths,
            improvements: a.feedback.improvements,
          }),
        ].join('\n'),
      ),
    ].join('\n\n')

    return [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]
  },
}
