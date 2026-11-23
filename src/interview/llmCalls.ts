import { generateStructured } from '../providers/llm/structuredOutput'
import type { LlmProvider } from '../providers/llm/types'
import type { Feedback, PitchFeedback, PlannedQuestion, ProfileInput, SessionSummary } from '../schemas'
import {
  classifyReply,
  decideFollowUp,
  compareProfileJob,
  evaluateAnswer,
  evaluatePitch,
  planQuestions,
  structureProfile,
  structureStory,
  suggestExpressions,
  summarizeSession,
  type ClassifyReplyInput,
  type DecideFollowUpInput,
  type CompareProfileJobInput,
  type EvaluateAnswerInput,
  type EvaluatePitchInput,
  type PlanQuestionsInput,
  type StructureProfileInput,
  type StructureStoryInput,
  type StructureStoryOutput,
  type JobRequirement,
  type Expression,
  type SuggestExpressionsInput,
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

/** Story assistant: a loosely told story → STAR fields, tags and what's missing. Not part of a session. */
export async function callStructureStory(
  llm: LlmProvider,
  input: StructureStoryInput,
  signal?: AbortSignal,
): Promise<StructureStoryOutput> {
  const out = await generateStructured(llm, {
    messages: structureStory.build(input),
    schema: structureStory.schema,
    name: structureStory.name,
    signal,
  })
  return structureStory.postProcess(out)
}

/** "Tell me about yourself" practice: scores and feedback for one version of the pitch. Not part of a session. */
export function callEvaluatePitch(llm: LlmProvider, input: EvaluatePitchInput, signal?: AbortSignal): Promise<PitchFeedback> {
  return generateStructured(llm, {
    messages: evaluatePitch.build(input),
    schema: evaluatePitch.schema,
    name: evaluatePitch.name,
    signal,
  })
}

/** English fluency: more natural phrasings for what the candidate said, asked for from the report. */
export async function callSuggestExpressions(
  llm: LlmProvider,
  input: SuggestExpressionsInput,
  signal?: AbortSignal,
): Promise<Expression[]> {
  const out = await generateStructured(llm, {
    messages: suggestExpressions.build(input),
    schema: suggestExpressions.schema,
    name: suggestExpressions.name,
    signal,
  })
  return suggestExpressions.postProcess(out, input)
}

/** CV text (from the uploaded file) → a structured profile for the user to review. Not part of a session. */
export async function callStructureProfile(
  llm: LlmProvider,
  input: StructureProfileInput,
  signal?: AbortSignal,
): Promise<ProfileInput> {
  const out = await generateStructured(llm, {
    messages: structureProfile.build(input),
    schema: structureProfile.schema,
    name: structureProfile.name,
    signal,
  })
  return structureProfile.postProcess(out)
}

/** What the job asks for and how well the CV shows each requirement, gaps first. Not part of a session. */
export async function callCompareProfileJob(
  llm: LlmProvider,
  input: CompareProfileJobInput,
  signal?: AbortSignal,
): Promise<JobRequirement[]> {
  const out = await generateStructured(llm, {
    messages: compareProfileJob.build(input),
    schema: compareProfileJob.schema,
    name: compareProfileJob.name,
    signal,
  })
  return compareProfileJob.postProcess(out)
}
