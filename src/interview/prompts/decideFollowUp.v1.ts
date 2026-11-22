import { z } from 'zod'
import type { ChatMessage } from '../../providers/llm/types'
import type { InterviewLanguage } from '../../schemas'
import { INTERVIEW_LANGUAGE_NAME, UNTRUSTED_NOTE, block } from './shared'

export interface DecideFollowUpInput {
  question: string
  transcript: string
  language: InterviewLanguage
}

export const DecideFollowUpOutput = z.object({
  needsFollowUp: z.boolean(),
  followUp: z.string().optional(),
})
export type DecideFollowUpOutput = z.infer<typeof DecideFollowUpOutput>

export const decideFollowUpV1 = {
  id: 'decideFollowUp',
  version: 'v1',
  name: 'decide_follow_up',
  schema: DecideFollowUpOutput,

  build({ question, transcript, language }: DecideFollowUpInput): ChatMessage[] {
    const system = [
      "You are the interviewer in a mock job interview. You just heard the candidate's answer.",
      'Decide whether one follow-up question is needed.',
      '',
      'Ask a follow-up ONLY when:',
      '- a part of STAR is missing (situation, task, action or result), or',
      '- the result has no concrete impact (no outcome, number or observable change).',
      'Otherwise set needsFollowUp to false and leave followUp out.',
      '',
      `If needed, followUp is one short, natural question in ${INTERVIEW_LANGUAGE_NAME[language]} that asks for the missing part.`,
      'Do not give feedback, praise or hints. Do not repeat the original question.',
      'The transcript comes from speech recognition: ignore missing punctuation and misheard words.',
      UNTRUSTED_NOTE,
    ].join('\n')

    return [
      { role: 'system', content: system },
      { role: 'user', content: [block('question', question), block('transcript', transcript)].join('\n\n') },
    ]
  },

  /** A "yes" without a question is treated as "no". */
  postProcess(out: DecideFollowUpOutput): { needsFollowUp: boolean; followUp?: string } {
    const text = out.followUp?.trim()
    return out.needsFollowUp && text ? { needsFollowUp: true, followUp: text } : { needsFollowUp: false }
  },
}
