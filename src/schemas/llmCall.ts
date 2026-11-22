import { z } from 'zod'

/** Which step of the interview made the call (one prompt each, see src/interview/prompts). */
export const LlmCallKind = z.enum([
  'planQuestions',
  'classifyReply',
  'decideFollowUp',
  'evaluateAnswer',
  'summarizeSession',
])
export type LlmCallKind = z.infer<typeof LlmCallKind>

export const TokenUsage = z.object({
  promptTokens: z.number().int().min(0),
  completionTokens: z.number().int().min(0),
})

/**
 * One request to the LLM during a session, to measure what a session costs. Each structured
 * output retry is its own call. `usage` is absent when the provider doesn't report it.
 */
export const LlmCall = z.object({
  id: z.string(),
  sessionId: z.string(),
  kind: LlmCallKind,
  model: z.string(),
  usage: TokenUsage.optional(),
  createdAt: z.string(),
})
export type LlmCall = z.infer<typeof LlmCall>
