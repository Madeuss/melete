import type { ChatMessage } from '../../providers/llm/types'
import { PitchFeedback, type InterviewLanguage, type TurnMetrics, type UiLanguage } from '../../schemas'
import { INTERVIEW_LANGUAGE_NAME, UI_LANGUAGE_NAME, UNTRUSTED_NOTE, block } from './shared'

export interface EvaluatePitchInput {
  transcript: string
  role?: string
  /** Spoken duration in seconds; undefined when typed. */
  seconds?: number
  metrics: TurnMetrics
  language: InterviewLanguage
  feedbackLanguage: UiLanguage
}

export const evaluatePitchV1 = {
  id: 'evaluatePitch',
  version: 'v1',
  name: 'evaluate_pitch',
  schema: PitchFeedback,

  build({ transcript, role, seconds, metrics, language, feedbackLanguage }: EvaluatePitchInput): ChatMessage[] {
    const fillers = Object.entries(metrics.fillerWords)
      .map(([w, n]) => `${w} ×${n}`)
      .join(', ')
    const system = [
      `You coach a candidate on their answer to "Tell me about yourself", the opening question of a job interview${role ? ` for a ${role} role` : ''}.`,
      '',
      'A strong answer:',
      '- lasts about 60 to 90 seconds when spoken;',
      '- follows present → past → future: who they are now, one or two relevant achievements with results, why this role now;',
      '- is tailored to the role instead of reciting the CV;',
      '- is specific (projects, numbers, outcomes) rather than adjectives;',
      '- ends with a clear link to the role.',
      '',
      'Score each from 0 to 5 (0 absent, 3 clear with some detail, 5 exemplary):',
      '- structure: present → past → future, easy to follow;',
      '- relevance: tailored to the role;',
      '- specificity: concrete achievements and results;',
      '- conciseness: fits the 60–90 second target without rushing (use the duration and word count given);',
      '- clarity: clear sentences, few filler words, natural delivery.',
      '',
      `strengths and improvements: at most 3 each, short and specific, in ${UI_LANGUAGE_NAME[feedbackLanguage]}.`,
      `improvedVersion: a better version in ${INTERVIEW_LANGUAGE_NAME[language]}, about 150 to 200 words, in the first person, ` +
        'using only facts from the transcript. Where a detail is missing, write a placeholder in brackets like [metric] or [company] instead of inventing it.',
      'The transcript may come from speech recognition: ignore missing punctuation and misheard words.',
      UNTRUSTED_NOTE,
    ].join('\n')

    const facts = [
      seconds !== undefined ? `Spoken duration: ${seconds} seconds` : 'Typed, not spoken (no duration)',
      `Words: ${metrics.wordCount}`,
      metrics.wordsPerMinute !== undefined ? `Speaking rate: ${metrics.wordsPerMinute} words per minute` : '',
      `Filler words: ${fillers || 'none'}`,
    ]
      .filter(Boolean)
      .join('\n')

    return [
      { role: 'system', content: system },
      { role: 'user', content: [block('transcript', transcript), block('delivery', facts)].join('\n\n') },
    ]
  },
}
