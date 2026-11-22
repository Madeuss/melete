/*
 * What a session costs: every LLM request is recorded with its token usage (when the provider
 * reports it), then added up per kind of call for the report.
 */
import type { LlmProvider, TokenUsage } from '../providers/llm/types'
import { LlmCallKind, type LlmCall } from '../schemas'

/**
 * Wraps a provider so every chat request (including each structured-output retry) is reported
 * through `record` before its result is used.
 */
export function recordingLlm(
  llm: LlmProvider,
  record: (usage: TokenUsage | undefined) => Promise<unknown>,
): LlmProvider {
  return {
    model: llm.model,
    capabilities: llm.capabilities,
    async chat(messages, opts) {
      const result = await llm.chat(messages, opts)
      await record(result.usage)
      return result
    },
  }
}

export interface UsageTotals {
  calls: number
  promptTokens: number
  completionTokens: number
  /** Calls the provider didn't report usage for (their tokens aren't in the sums). */
  callsWithoutUsage: number
}

export interface SessionUsage {
  total: UsageTotals
  /** Kinds that had at least one call, in the order the interview makes them. */
  byKind: Array<{ kind: LlmCallKind } & UsageTotals>
}

const empty = (): UsageTotals => ({ calls: 0, promptTokens: 0, completionTokens: 0, callsWithoutUsage: 0 })

function add(totals: UsageTotals, call: LlmCall) {
  totals.calls++
  if (call.usage) {
    totals.promptTokens += call.usage.promptTokens
    totals.completionTokens += call.usage.completionTokens
  } else {
    totals.callsWithoutUsage++
  }
}

export function aggregateUsage(calls: LlmCall[]): SessionUsage {
  const total = empty()
  const kinds = new Map<LlmCallKind, UsageTotals>()
  for (const call of calls) {
    add(total, call)
    const forKind = kinds.get(call.kind) ?? empty()
    add(forKind, call)
    kinds.set(call.kind, forKind)
  }
  const byKind = LlmCallKind.options.flatMap((kind) => {
    const totals = kinds.get(kind)
    return totals ? [{ kind, ...totals }] : []
  })
  return { total, byKind }
}
