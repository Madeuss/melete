import { z } from 'zod'
import { PlannedQuestion, type InterviewLanguage, type SessionConfig } from '../../schemas'
import type { ChatMessage } from '../../providers/llm/types'
import { INTERVIEW_LANGUAGE_NAME, UNTRUSTED_NOTE, block } from './shared'

export interface StorySummary {
  id: string
  title: string
  tags: string[]
}

export interface PlanQuestionsInput {
  config: SessionConfig
  stories: StorySummary[]
  language: InterviewLanguage
}

export const PlanQuestionsOutput = z.object({ questions: z.array(PlannedQuestion).min(1) })
export type PlanQuestionsOutput = z.infer<typeof PlanQuestionsOutput>

const TYPE_GUIDE: Record<SessionConfig['type'], string> = {
  behavioral:
    'All questions are behavioral ("Tell me about a time…", "Describe a situation…"), each one targeting a different competency.',
  technical:
    'All questions are technical and answerable out loud without writing code: concepts, debugging approaches, system design, trade-offs and past technical decisions, at the depth expected for the seniority.',
  mixed: 'Alternate behavioral and technical questions, starting with a behavioral one.',
}

export const planQuestionsV1 = {
  id: 'planQuestions',
  version: 'v1',
  name: 'plan_questions',
  schema: PlanQuestionsOutput,

  build({ config, stories, language }: PlanQuestionsInput): ChatMessage[] {
    const storyList = stories.length
      ? stories.map((s) => `- id: ${s.id} | title: ${s.title} | tags: ${s.tags.join(', ') || '(none)'}`).join('\n')
      : '(the candidate has no stories saved)'

    const system = [
      'You are an experienced interviewer preparing a mock job interview.',
      `Plan exactly ${config.questionCount} questions for a ${config.seniority} ${config.role} candidate.`,
      TYPE_GUIDE[config.type],
      `Write every question in ${INTERVIEW_LANGUAGE_NAME[language]}.`,
      '',
      'Rules:',
      '- One question per item. No compound questions with several parts.',
      '- Ask the way a real interviewer would: short, natural, spoken language.',
      '- Order them like a real interview: warmer questions first, harder ones later.',
      "- When a question is meant to pull one of the candidate's stories, set storyId to that story's id. Use each story at most once. Never mention the story title in the question.",
      '- Only use story ids from the list. Leave storyId out when no story fits.',
      '- competency is a short label in English, like ownership, conflict, leadership, system design.',
      '- If there is a job description, aim the questions at what it asks for.',
      UNTRUSTED_NOTE,
    ].join('\n')

    const user = [
      `Interview type: ${config.type}`,
      `Role: ${config.role}`,
      `Seniority: ${config.seniority}`,
      `Number of questions: ${config.questionCount}`,
      block('job_description', config.jobDescription),
      block('stories', storyList),
    ].join('\n\n')

    return [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]
  },

  /** Keeps at most questionCount questions and drops story ids that don't exist. */
  postProcess(out: PlanQuestionsOutput, input: PlanQuestionsInput): PlannedQuestion[] {
    const ids = new Set(input.stories.map((s) => s.id))
    const used = new Set<string>()
    return out.questions.slice(0, input.config.questionCount).map((q) => {
      const storyId = q.storyId && ids.has(q.storyId) && !used.has(q.storyId) ? q.storyId : undefined
      if (storyId) used.add(storyId)
      return { text: q.text.trim(), competency: q.competency.trim(), ...(storyId ? { storyId } : {}) }
    })
  },
}
