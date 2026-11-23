/*
 * v2: v1 plus the candidate's CV, when the interview uses it, to flag answers that contradict
 * it (titles, companies, dates, numbers): an interviewer who read the CV would notice.
 */
import type { ChatMessage } from '../../providers/llm/types'
import { Feedback, type Profile } from '../../schemas'
import { evaluateAnswerV1, type EvaluateAnswerInput } from './evaluateAnswer.v1'
import { UI_LANGUAGE_NAME, block, profileText } from './shared'

export type EvaluateAnswerV2Input = EvaluateAnswerInput & { profile?: Profile }

export const evaluateAnswerV2 = {
  ...evaluateAnswerV1,
  version: 'v2',
  schema: Feedback,

  build(input: EvaluateAnswerV2Input): ChatMessage[] {
    const [system, user] = evaluateAnswerV1.build(input)
    if (!input.profile) return [system, user]
    const rule =
      '\n\nThe candidate\'s CV is included. cvMismatches: at most 3 short notes, in ' +
      `${UI_LANGUAGE_NAME[input.feedbackLanguage]}, where the answer contradicts the CV (job title, company, dates, durations, numbers). ` +
      'Only clear contradictions, not details the CV simply leaves out. Empty list if none.'
    return [
      { ...system, content: system.content + rule },
      { ...user, content: `${user.content}\n\n${block('cv', profileText(input.profile))}` },
    ]
  },
}
