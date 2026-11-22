/*
 * Current prompt versions. To try a new version, add `<name>.v2.ts` next to v1 and switch it here;
 * evals/run.ts can compare versions side by side.
 */
export { classifyReplyV1 as classifyReply } from './classifyReply.v1'
export { decideFollowUpV1 as decideFollowUp } from './decideFollowUp.v1'
export { evaluateAnswerV1 as evaluateAnswer } from './evaluateAnswer.v1'
export { planQuestionsV1 as planQuestions } from './planQuestions.v1'
export { structureStoryV1 as structureStory } from './structureStory.v1'
export { summarizeSessionV1 as summarizeSession } from './summarizeSession.v1'

export type { ClassifyReplyInput } from './classifyReply.v1'
export type { DecideFollowUpInput } from './decideFollowUp.v1'
export type { EvaluateAnswerInput } from './evaluateAnswer.v1'
export type { PlanQuestionsInput, StorySummary } from './planQuestions.v1'
export type { StructureStoryInput, StructureStoryOutput } from './structureStory.v1'
export type { SummarizeSessionInput } from './summarizeSession.v1'
