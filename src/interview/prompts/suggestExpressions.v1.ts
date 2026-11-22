import { z } from 'zod'
import type { ChatMessage } from '../../providers/llm/types'
import type { UiLanguage } from '../../schemas'
import { UI_LANGUAGE_NAME, UNTRUSTED_NOTE, block } from './shared'

export interface SuggestExpressionsInput {
  /** The candidate's answers in the session, in English. */
  answers: string[]
  feedbackLanguage: UiLanguage
}

export const SuggestExpressionsOutput = z.object({
  suggestions: z.array(z.object({ said: z.string(), better: z.string(), why: z.string() })),
})
export type Expression = z.infer<typeof SuggestExpressionsOutput>['suggestions'][number]

const MAX = 6

export const suggestExpressionsV1 = {
  id: 'suggestExpressions',
  version: 'v1',
  name: 'suggest_expressions',
  schema: SuggestExpressionsOutput,

  build({ answers, feedbackLanguage }: SuggestExpressionsInput): ChatMessage[] {
    const system = [
      'You are an English coach for non-native speakers preparing for job interviews.',
      `Read the candidate's answers and pick up to ${MAX} phrases that a native speaker would say differently.`,
      'Look for: literal translations (often from Portuguese or Spanish), wrong prepositions, false friends, unnatural word combinations, and overused vague words where a precise one fits better.',
      '',
      'For each:',
      '- said: the exact words from the answers (copy them, a short phrase, not a whole sentence);',
      '- better: how a native speaker would say it in an interview;',
      `- why: one short sentence in ${UI_LANGUAGE_NAME[feedbackLanguage]}.`,
      '',
      'The answers come from speech recognition: ignore missing punctuation and words that were obviously misheard. ' +
        'Do not correct the content of the answer, only the English. If the English is already natural, return an empty list.',
      UNTRUSTED_NOTE,
    ].join('\n')
    return [
      { role: 'system', content: system },
      { role: 'user', content: answers.map((a, i) => block(`answer_${i + 1}`, a)).join('\n\n') },
    ]
  },

  /** Keeps only phrases that really appear in the answers (the model must not invent quotes). */
  postProcess(out: z.infer<typeof SuggestExpressionsOutput>, input: SuggestExpressionsInput): Expression[] {
    const text = input.answers.join('\n').toLowerCase()
    return out.suggestions
      .map((s) => ({ said: s.said.trim(), better: s.better.trim(), why: s.why.trim() }))
      .filter((s) => s.said && s.better && s.said.toLowerCase() !== s.better.toLowerCase() && text.includes(s.said.toLowerCase()))
      .slice(0, MAX)
  },
}
