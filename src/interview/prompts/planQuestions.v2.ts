/*
 * v2: v1 plus the interview stage (recruiter, hiring manager, technical, values, final round),
 * which sets the interviewer's tone and the kind of questions; and competencies taken from the
 * story tags when one fits, so practice can later be matched with the coverage map.
 */
import { SUGGESTED_TAGS, type InterviewStage, type SessionConfig } from '../../schemas'
import type { ChatMessage } from '../../providers/llm/types'
import { planQuestionsV1, type PlanQuestionsInput } from './planQuestions.v1'
import { INTERVIEW_LANGUAGE_NAME, UNTRUSTED_NOTE, block } from './shared'

const TYPE_GUIDE: Record<SessionConfig['type'], string> = {
  behavioral:
    'All questions are behavioral ("Tell me about a time…", "Describe a situation…"), each one targeting a different competency.',
  technical:
    'All questions are technical and answerable out loud without writing code: concepts, debugging approaches, system design, trade-offs and past technical decisions, at the depth expected for the seniority.',
  mixed: 'Alternate behavioral and technical questions, starting with a behavioral one.',
}

/** Who is interviewing and what that stage of a real process looks for. */
export const STAGE_GUIDE: Record<InterviewStage, string> = {
  recruiter:
    'Stage: recruiter screen. You are a friendly recruiter keeping it light and brief. Focus on motivation, the career story, why this company and role, and how clearly the candidate communicates. No deep technical questions.',
  hiringManager:
    "Stage: hiring manager. You are the candidate's future manager: direct and probing. Focus on ownership, impact, prioritization, working with stakeholders, ambiguity and failure, in the context of this team.",
  technical:
    'Stage: technical interview. You are an engineer on the team. Focus on past technical decisions, trade-offs, debugging, architecture and quality, asked as questions about real experience.',
  values:
    "Stage: values and culture. You assess fit with the company's principles. Behavioral questions about collaboration, feedback, integrity, customer focus and learning from mistakes.",
  final:
    'Stage: final round with a senior leader. Big picture: career goals, why this company, leading and influencing others, a hard decision, and what the candidate would focus on in the first months.',
}

export const planQuestionsV2 = {
  ...planQuestionsV1,
  version: 'v2',

  build({ config, stories, language }: PlanQuestionsInput): ChatMessage[] {
    const storyList = stories.length
      ? stories.map((s) => `- id: ${s.id} | title: ${s.title} | tags: ${s.tags.join(', ') || '(none)'}`).join('\n')
      : '(the candidate has no stories saved)'

    const system = [
      'You are an experienced interviewer preparing a mock job interview.',
      `Plan exactly ${config.questionCount} questions for a ${config.seniority} ${config.role} candidate.`,
      TYPE_GUIDE[config.type],
      ...(config.stage ? [STAGE_GUIDE[config.stage], 'Phrase the questions in the tone of that interviewer.'] : []),
      `Write every question in ${INTERVIEW_LANGUAGE_NAME[language]}.`,
      '',
      'Rules:',
      '- One question per item. No compound questions with several parts.',
      '- Ask the way a real interviewer would: short, natural, spoken language.',
      '- Order them like a real interview: warmer questions first, harder ones later.',
      "- When a question is meant to pull one of the candidate's stories, set storyId to that story's id. Use each story at most once. Never mention the story title in the question.",
      '- Only use story ids from the list. Leave storyId out when no story fits.',
      `- competency is a short label in English. When one of these fits, use it exactly: ${SUGGESTED_TAGS.join(', ')}. Otherwise use a short label like system design.`,
      '- If there is a job description, aim the questions at what it asks for.',
      UNTRUSTED_NOTE,
    ].join('\n')

    const user = [
      `Interview type: ${config.type}`,
      ...(config.stage ? [`Stage: ${config.stage}`] : []),
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
}
