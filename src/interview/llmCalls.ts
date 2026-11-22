import { generateStructured } from '../providers/llm/structuredOutput'
import type { LlmProvider } from '../providers/llm/types'
import type { Feedback, PlannedQuestion, SessionSummary } from '../schemas'
import {
  classifyReply,
  decideFollowUp,
  evaluateAnswer,
  planQuestions,
  summarizeSession,
  type ClassifyReplyInput,
  type DecideFollowUpInput,
  type EvaluateAnswerInput,
  type PlanQuestionsInput,
  type SummarizeSessionInput,
} from './prompts'

/** The LLM calls of a session, each with structured output and validation. */

export async function callPlanQuestions(
  llm: LlmProvider,
  input: PlanQuestionsInput,
  signal?: AbortSignal,
): Promise<PlannedQuestion[]> {
  const out = await generateStructured(llm, {
    messages: planQuestions.build(input),
    schema: planQuestions.schema,
    name: planQuestions.name,
    signal,
  })
  return planQuestions.postProcess(out, input)
}

export async function callDecideFollowUp(
  llm: LlmProvider,
  input: DecideFollowUpInput,
  signal?: AbortSignal,
): Promise<{ needsFollowUp: boolean; followUp?: string }> {
  const out = await generateStructured(llm, {
    messages: decideFollowUp.build(input),
    schema: decideFollowUp.schema,
    name: decideFollowUp.name,
    signal,
  })
  return decideFollowUp.postProcess(out)
}

export async function callClassifyReply(
  llm: LlmProvider,
  input: ClassifyReplyInput,
  signal?: AbortSignal,
): Promise<'answer' | 'repeat'> {
  const out = await generateStructured(llm, {
    messages: classifyReply.build(input),
    schema: classifyReply.schema,
    name: classifyReply.name,
    signal,
  })
  return out.intent
}

export function callEvaluateAnswer(llm: LlmProvider, input: EvaluateAnswerInput, signal?: AbortSignal): Promise<Feedback> {
  return generateStructured(llm, {
    messages: evaluateAnswer.build(input),
    schema: evaluateAnswer.schema,
    name: evaluateAnswer.name,
    signal,
  })
}

export function callSummarizeSession(
  llm: LlmProvider,
  input: SummarizeSessionInput,
  signal?: AbortSignal,
): Promise<SessionSummary> {
  return generateStructured(llm, {
    messages: summarizeSession.build(input),
    schema: summarizeSession.schema,
    name: summarizeSession.name,
    signal,
  })
}
