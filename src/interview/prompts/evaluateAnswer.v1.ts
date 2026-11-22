import type { ChatMessage } from '../../providers/llm/types'
import { Feedback, type InterviewLanguage, type Story, type TurnMetrics, type UiLanguage } from '../../schemas'
import { INTERVIEW_LANGUAGE_NAME, RUBRIC, STAR_FOR_TECHNICAL, UI_LANGUAGE_NAME, UNTRUSTED_NOTE, block } from './shared'

export interface EvaluateAnswerInput {
  question: string
  competency?: string
  transcript: string
  /** The story the question tried to pull, if any. */
  story?: Pick<Story, 'title' | 'situation' | 'task' | 'action' | 'result'>
  metrics: TurnMetrics
  /** For a follow-up: the main question and answer it follows. */
  previous?: { question: string; transcript: string }
  interviewType: 'behavioral' | 'technical' | 'mixed'
  language: InterviewLanguage
  /** Language for strengths and improvements (the user's interface language). */
  feedbackLanguage: UiLanguage
}

function metricsText(m: TurnMetrics): string {
  const fillers = Object.entries(m.fillerWords)
    .map(([w, n]) => `${w} ×${n}`)
    .join(', ')
  return [
    `Words: ${m.wordCount}`,
    m.wordsPerMinute !== undefined ? `Speaking rate: ${m.wordsPerMinute} words per minute` : 'Typed answer (no speaking rate)',
    `Filler words: ${fillers || 'none'}`,
  ].join('\n')
}

export const evaluateAnswerV1 = {
  id: 'evaluateAnswer',
  version: 'v1',
  name: 'evaluate_answer',
  schema: Feedback,

  build(input: EvaluateAnswerInput): ChatMessage[] {
    const system = [
      'You are a strict but fair interview coach evaluating one answer from a mock job interview.',
      '',
      RUBRIC,
      '',
      'Score star.situation, star.task, star.action, star.result and clarity with that rubric.',
      STAR_FOR_TECHNICAL,
      'clarity covers structure, concision and how easy it is to follow when heard. Fillers and a very fast or very slow pace (comfortable is roughly 120–160 words per minute) lower it a little.',
      'answeredTheQuestion is false when the answer is about something else or dodges what was asked.',
      '',
      `Write strengths and improvements in ${UI_LANGUAGE_NAME[input.feedbackLanguage]}: at most 3 each, short and specific to this answer, never generic advice.`,
      `Write improvedAnswer in ${INTERVIEW_LANGUAGE_NAME[input.language]}, in first person, as the candidate would say it out loud: the same story, better told and well structured, about 120–200 words.`,
      'Use ONLY facts from the transcript and the saved story. Never invent numbers, names, tools or results. When a concrete detail is missing, write a placeholder in square brackets, like [metric] or [timeframe], so the candidate knows what to fill in.',
      'The transcript comes from speech recognition: do not penalize missing punctuation or misheard words.',
      UNTRUSTED_NOTE,
    ].join('\n')

    const parts = [
      `Interview type: ${input.interviewType}`,
      input.competency ? `Competency being assessed: ${input.competency}` : '',
      input.previous
        ? [
            'This is a follow-up. The original exchange was:',
            block('original_question', input.previous.question),
            block('original_answer', input.previous.transcript),
          ].join('\n')
        : '',
      block('question', input.question),
      block('transcript', input.transcript),
      input.story
        ? block(
            'saved_story',
            [
              `Title: ${input.story.title}`,
              `Situation: ${input.story.situation}`,
              `Task: ${input.story.task}`,
              `Action: ${input.story.action}`,
              `Result: ${input.story.result}`,
            ].join('\n'),
          )
        : '',
      block('metrics', metricsText(input.metrics)),
    ].filter(Boolean)

    return [
      { role: 'system', content: system },
      { role: 'user', content: parts.join('\n\n') },
    ]
  },
}
