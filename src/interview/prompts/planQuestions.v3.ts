/*
 * v3: v2 plus the candidate's CV, when they chose to use it: questions about specific
 * experiences, gaps and career changes, and about job requirements the CV doesn't show.
 */
import type { ChatMessage } from '../../providers/llm/types'
import type { Profile } from '../../schemas'
import { planQuestionsV2 } from './planQuestions.v2'
import type { PlanQuestionsInput } from './planQuestions.v1'
import { block, profileText } from './shared'

export type PlanQuestionsV3Input = PlanQuestionsInput & { profile?: Profile }

const CV_RULES = [
  '',
  "The candidate's CV is included. Use it like a real interviewer who read it:",
  '- Make about a third of the questions about specific experiences in it (for example "Walk me through your time at <company>" or about one of their achievements).',
  '- If there is a gap between jobs or a change of career, you may ask about it once, politely.',
  '- If there is a job description, ask about at least one requirement the CV does not clearly show.',
  '- Never state facts that are not in the CV.',
].join('\n')

export const planQuestionsV3 = {
  ...planQuestionsV2,
  version: 'v3',

  build(input: PlanQuestionsV3Input): ChatMessage[] {
    const [system, user] = planQuestionsV2.build(input)
    if (!input.profile) return [system, user]
    return [
      { ...system, content: system.content + CV_RULES },
      { ...user, content: `${user.content}\n\n${block('cv', profileText(input.profile))}` },
    ]
  },
}
