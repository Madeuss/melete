import { z } from 'zod'
import type { ChatMessage } from '../../providers/llm/types'
import { UNTRUSTED_NOTE, block } from './shared'

export interface ClassifyReplyInput {
  question: string
  transcript: string
}

export const ClassifyReplyOutput = z.object({
  /** repeat = the candidate asks to hear or rephrase the question instead of answering it. */
  intent: z.enum(['answer', 'repeat']),
})
export type ClassifyReplyOutput = z.infer<typeof ClassifyReplyOutput>

/** Only short replies are classified: a long one is an answer. */
export const classifyReplyV1 = {
  id: 'classifyReply',
  version: 'v1',
  name: 'classify_reply',
  schema: ClassifyReplyOutput,

  build({ question, transcript }: ClassifyReplyInput): ChatMessage[] {
    const system = [
      'You are the interviewer in a mock job interview. You asked a question and the candidate said something short.',
      'Decide what the candidate meant:',
      '- "repeat": they did not hear or understand the question and ask you to say it again or rephrase it',
      '  (e.g. "could you repeat that?", "sorry, I didn\'t get it", "pardon?", "can you say it again?").',
      '- "answer": anything else, including short or weak answers such as "I don\'t know" or "I never did that".',
      'The transcript comes from speech recognition: ignore missing punctuation and misheard words.',
      UNTRUSTED_NOTE,
    ].join('\n')

    return [
      { role: 'system', content: system },
      { role: 'user', content: [block('question', question), block('transcript', transcript)].join('\n\n') },
    ]
  },
}
