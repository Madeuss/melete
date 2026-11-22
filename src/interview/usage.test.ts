import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { FakeLlm } from '../providers/fakes/FakeLlm'
import { generateStructured } from '../providers/llm/structuredOutput'
import type { TokenUsage } from '../providers/llm/types'
import type { LlmCall, LlmCallKind } from '../schemas'
import { aggregateUsage, recordingLlm } from './usage'

let n = 0
const call = (kind: LlmCallKind, usage?: [number, number]): LlmCall => ({
  id: `c${++n}`,
  sessionId: 's',
  kind,
  model: 'm',
  createdAt: '',
  ...(usage ? { usage: { promptTokens: usage[0], completionTokens: usage[1] } } : {}),
})

describe('aggregateUsage', () => {
  it('adds up the totals and each kind, listing kinds in interview order', () => {
    const usage = aggregateUsage([
      call('summarizeSession', [900, 200]),
      call('evaluateAnswer', [500, 150]),
      call('planQuestions', [300, 120]),
      call('evaluateAnswer', [520, 160]),
    ])
    expect(usage.total).toEqual({ calls: 4, promptTokens: 2220, completionTokens: 630, callsWithoutUsage: 0 })
    expect(usage.byKind).toEqual([
      { kind: 'planQuestions', calls: 1, promptTokens: 300, completionTokens: 120, callsWithoutUsage: 0 },
      { kind: 'evaluateAnswer', calls: 2, promptTokens: 1020, completionTokens: 310, callsWithoutUsage: 0 },
      { kind: 'summarizeSession', calls: 1, promptTokens: 900, completionTokens: 200, callsWithoutUsage: 0 },
    ])
  })

  it('counts calls without usage separately and leaves them out of the sums', () => {
    const usage = aggregateUsage([call('decideFollowUp', [200, 20]), call('decideFollowUp'), call('classifyReply')])
    expect(usage.total).toEqual({ calls: 3, promptTokens: 200, completionTokens: 20, callsWithoutUsage: 2 })
    expect(usage.byKind).toEqual([
      { kind: 'classifyReply', calls: 1, promptTokens: 0, completionTokens: 0, callsWithoutUsage: 1 },
      { kind: 'decideFollowUp', calls: 2, promptTokens: 200, completionTokens: 20, callsWithoutUsage: 1 },
    ])
  })

  it('is empty for a session with no recorded calls (older sessions)', () => {
    expect(aggregateUsage([])).toEqual({
      total: { calls: 0, promptTokens: 0, completionTokens: 0, callsWithoutUsage: 0 },
      byKind: [],
    })
  })
})

describe('recordingLlm', () => {
  it('records every request, including each structured-output retry', async () => {
    const llm = new FakeLlm(['not json', '{"answer": 42}'], { supportsJsonObject: true })
    llm.usage = { promptTokens: 100, completionTokens: 10 }
    const recorded: Array<TokenUsage | undefined> = []
    const out = await generateStructured(
      recordingLlm(llm, async (usage) => recorded.push(usage)),
      { messages: [{ role: 'user', content: 'q' }], schema: z.object({ answer: z.number() }), name: 'x' },
    )
    expect(out).toEqual({ answer: 42 })
    expect(recorded).toEqual([
      { promptTokens: 100, completionTokens: 10 },
      { promptTokens: 100, completionTokens: 10 },
    ])
  })

  it('records a request without usage when the provider does not report it', async () => {
    const recorded: Array<TokenUsage | undefined> = []
    const result = await recordingLlm(new FakeLlm(['hi']), async (usage) => recorded.push(usage)).chat([])
    expect(result).toEqual({ content: 'hi' })
    expect(recorded).toEqual([undefined])
  })
})
