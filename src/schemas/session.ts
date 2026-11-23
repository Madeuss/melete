import { z } from 'zod'
import { SessionSummary } from './feedback'
import { InterviewLanguage } from './settings'

export const PlannedQuestion = z.object({
  text: z.string().min(1),
  competency: z.string(), // e.g. ownership, conflict, system design
  storyId: z.string().optional(), // story the question tries to pull
})
export type PlannedQuestion = z.infer<typeof PlannedQuestion>

export const InterviewType = z.enum(['behavioral', 'technical', 'mixed'])
export type InterviewType = z.infer<typeof InterviewType>

export const Seniority = z.enum(['junior', 'mid', 'senior', 'staff'])
export type Seniority = z.infer<typeof Seniority>

export const FeedbackTiming = z.enum(['per-answer', 'end'])
export type FeedbackTiming = z.infer<typeof FeedbackTiming>

/**
 * standard: question shown as text, answers by voice or typing.
 * hard: closer to a real interview: voice only, the question is blurred until the candidate
 * reveals it, and asking out loud for a repeat works.
 */
export const Difficulty = z.enum(['standard', 'hard'])
export type Difficulty = z.infer<typeof Difficulty>

/** The stage of a real hiring process the mock interview simulates (tone and kind of questions). */
export const InterviewStage = z.enum(['recruiter', 'hiringManager', 'technical', 'values', 'final'])
export type InterviewStage = z.infer<typeof InterviewStage>

export const SessionConfig = z.object({
  type: InterviewType,
  role: z.string().trim().min(1),
  seniority: Seniority,
  jobDescription: z.string().optional(),
  questionCount: z.number().int().min(1).max(15),
  followUps: z.boolean(),
  feedbackTiming: FeedbackTiming,
  difficulty: Difficulty.default('standard'),
  /** Absent = a general interview, as before stages existed. */
  stage: InterviewStage.optional(),
  /** Whether the interviewer uses the candidate's CV profile (questions and consistency checks). */
  useProfile: z.boolean().optional(),
})
export type SessionConfig = z.infer<typeof SessionConfig>

export const SessionStatus = z.enum(['in-progress', 'finished', 'abandoned'])
export type SessionStatus = z.infer<typeof SessionStatus>

export const Session = z.object({
  id: z.string(),
  createdAt: z.string(),
  config: SessionConfig,
  model: z.string(), // model used, to compare later
  /** Interview language at the time of the session (settings can change later). */
  language: InterviewLanguage.default('en'),
  status: SessionStatus,
  plannedQuestions: z.array(PlannedQuestion),
  summary: SessionSummary.optional(),
  /**
   * Set when this session is a new attempt at one question of an earlier session ("answer again").
   * It has that single question, no follow-ups and no summary; the report compares the two answers.
   */
  retryOf: z.object({ sessionId: z.string(), turnId: z.string() }).optional(),
  /** More natural English for phrases the candidate used, asked for from the report. */
  expressions: z.array(z.object({ said: z.string(), better: z.string(), why: z.string() })).optional(),
})
export type Session = z.infer<typeof Session>
