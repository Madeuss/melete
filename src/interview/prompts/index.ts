/*
 * Current prompt versions. To try a new version, add `<name>.v2.ts` next to v1 and switch it here;
 * evals/run.ts can compare versions side by side.
 */
export { classifyReplyV1 as classifyReply } from './classifyReply.v1'
export { decideFollowUpV1 as decideFollowUp } from './decideFollowUp.v1'
export { compareProfileJobV1 as compareProfileJob } from './compareProfileJob.v1'
export { evaluateAnswerV2 as evaluateAnswer } from './evaluateAnswer.v2'
export { evaluatePitchV1 as evaluatePitch } from './evaluatePitch.v1'
export { planQuestionsV3 as planQuestions } from './planQuestions.v3'
export { structureProfileV1 as structureProfile } from './structureProfile.v1'
export { structureStoryV1 as structureStory } from './structureStory.v1'
export { suggestExpressionsV1 as suggestExpressions } from './suggestExpressions.v1'
export { summarizeSessionV1 as summarizeSession } from './summarizeSession.v1'

export type { ClassifyReplyInput } from './classifyReply.v1'
export type { DecideFollowUpInput } from './decideFollowUp.v1'
export type { CompareProfileJobInput, JobRequirement } from './compareProfileJob.v1'
export type { EvaluateAnswerV2Input as EvaluateAnswerInput } from './evaluateAnswer.v2'
export type { EvaluatePitchInput } from './evaluatePitch.v1'
export type { StorySummary } from './planQuestions.v1'
export type { PlanQuestionsV3Input as PlanQuestionsInput } from './planQuestions.v3'
export type { StructureProfileInput } from './structureProfile.v1'
export type { StructureStoryInput, StructureStoryOutput } from './structureStory.v1'
export type { Expression, SuggestExpressionsInput } from './suggestExpressions.v1'
export type { SummarizeSessionInput } from './summarizeSession.v1'
