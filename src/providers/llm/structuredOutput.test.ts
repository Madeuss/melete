import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { FakeLlm } from '../fakes/FakeLlm'
import { LlmError } from './errors'
import { extractJson, generateStructured, pickMode } from './structuredOutput'

const Schema = z.object({ needsFollowUp: z.boolean(), followUp: z.string().optional() })
const messages = [
  { role: 'system' as const, content: 'You are an interviewer.' },
  { role: 'user' as const, content: 'Decide.' },
]

describe('extractJson', () => {
  it('parses plain JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
  })
  it('handles markdown fences and prose around the object', () => {
    expect(extractJson('Sure! Here it is:\n```json\n{"a": {"b": "x}"}}\n```\nAnything else?')).toEqual({
      a: { b: 'x}' },
    })
  })
  it('skips <think> blocks from reasoning models', () => {
    expect(extractJson('<think>maybe {"a":0}</think>{"a":2}')).toEqual({ a: 2 })
  })
  it('skips a broken object and takes the next valid one', () => {
    expect(extractJson('{not json} then {"ok":true}')).toEqual({ ok: true })
  })
  it('throws when there is no object', () => {
    expect(() => extractJson('no json here')).toThrow(SyntaxError)
  })
})

describe('pickMode', () => {
  it('prefers json_schema, then json_object, then prompt', () => {
    expect(pickMode({ supportsJsonSchema: true, supportsJsonObject: true })).toBe('json_schema')
    expect(pickMode({ supportsJsonSchema: false, supportsJsonObject: true })).toBe('json_object')
    expect(pickMode({ supportsJsonSchema: false, supportsJsonObject: false })).toBe('prompt')
  })
})

describe('generateStructured', () => {
  it('json_schema mode sends response_format with the schema', async () => {
    const llm = new FakeLlm(['{"needsFollowUp":false}'], { supportsJsonSchema: true, supportsJsonObject: true })
    const out = await generateStructured(llm, { messages, schema: Schema, name: 'follow_up' })
    expect(out).toEqual({ needsFollowUp: false })
    const rf = llm.calls[0].opts.responseFormat
    expect(rf?.type).toBe('json_schema')
    if (rf?.type === 'json_schema') {
      expect(rf.json_schema.name).toBe('follow_up')
      expect(rf.json_schema.schema).toMatchObject({ type: 'object', required: ['needsFollowUp'] })
    }
  })

  it('json_object mode sends type json_object and mentions JSON in the prompt', async () => {
    const llm = new FakeLlm(['{"needsFollowUp":true,"followUp":"What was the result?"}'], {
      supportsJsonObject: true,
    })
    const out = await generateStructured(llm, { messages, schema: Schema, name: 'f' })
    expect(out.followUp).toBe('What was the result?')
    expect(llm.calls[0].opts.responseFormat).toEqual({ type: 'json_object' })
    expect(llm.calls[0].messages[0].content).toContain('JSON')
  })

  it('prompt mode sends no response_format, merges the instruction into the system message and extracts JSON', async () => {
    const llm = new FakeLlm(['Okay.\n```json\n{"needsFollowUp":false}\n```'])
    const out = await generateStructured(llm, { messages, schema: Schema, name: 'f' })
    expect(out).toEqual({ needsFollowUp: false })
    const call = llm.calls[0]
    expect(call.opts.responseFormat).toBeUndefined()
    expect(call.messages.filter((m) => m.role === 'system')).toHaveLength(1)
    expect(call.messages[0].content).toMatch(/^You are an interviewer\.[\s\S]*JSON Schema/)
  })

  it('adds a system message when the conversation has none', async () => {
    const llm = new FakeLlm(['{"needsFollowUp":false}'])
    await generateStructured(llm, { messages: [{ role: 'user', content: 'x' }], schema: Schema, name: 'f' })
    expect(llm.calls[0].messages.map((m) => m.role)).toEqual(['system', 'user'])
  })

  it('retries with the validation error and succeeds', async () => {
    const llm = new FakeLlm(['{"needsFollowUp":"yes"}', '{"needsFollowUp":true,"followUp":"And then?"}'])
    const out = await generateStructured(llm, { messages, schema: Schema, name: 'f' })
    expect(out.needsFollowUp).toBe(true)
    expect(llm.calls).toHaveLength(2)
    const retry = llm.calls[1].messages
    expect(retry.at(-2)).toEqual({ role: 'assistant', content: '{"needsFollowUp":"yes"}' })
    expect(retry.at(-1)?.content).toContain('needsFollowUp')
    expect(retry.at(-1)?.content).toContain('corrected JSON')
  })

  it('retries when the reply is not JSON at all', async () => {
    const llm = new FakeLlm(['I think they should elaborate.', '{"needsFollowUp":false}'])
    await expect(generateStructured(llm, { messages, schema: Schema, name: 'f' })).resolves.toEqual({
      needsFollowUp: false,
    })
  })

  it('gives up after 2 retries (3 calls) with invalid-output', async () => {
    const llm = new FakeLlm(['{}', '{}', '{}', '{"needsFollowUp":false}'])
    const err = await generateStructured(llm, { messages, schema: Schema, name: 'f' }).catch((e) => e)
    expect(err).toBeInstanceOf(LlmError)
    expect((err as LlmError).kind).toBe('invalid-output')
    expect(llm.calls).toHaveLength(3)
  })

  it('respects maxRetries', async () => {
    const llm = new FakeLlm(['{}', '{}'])
    await expect(generateStructured(llm, { messages, schema: Schema, name: 'f', maxRetries: 0 })).rejects.toThrow()
    expect(llm.calls).toHaveLength(1)
  })

  it('downgrades json_schema → json_object → prompt when the provider rejects response_format', async () => {
    const llm = new FakeLlm(
      [
        new LlmError('bad-request', { status: 400 }),
        new LlmError('bad-request', { status: 400 }),
        '{"needsFollowUp":false}',
      ],
      { supportsJsonSchema: true, supportsJsonObject: true },
    )
    await generateStructured(llm, { messages, schema: Schema, name: 'f', maxRetries: 0 })
    expect(llm.calls.map((c) => c.opts.responseFormat?.type ?? 'prompt')).toEqual([
      'json_schema',
      'json_object',
      'prompt',
    ])
  })

  it('does not retry on auth errors', async () => {
    const llm = new FakeLlm([new LlmError('auth', { status: 401 })], { supportsJsonSchema: true })
    const err = await generateStructured(llm, { messages, schema: Schema, name: 'f' }).catch((e) => e)
    expect((err as LlmError).kind).toBe('auth')
    expect(llm.calls).toHaveLength(1)
  })

  it('propagates cancellation as aborted', async () => {
    const llm = new FakeLlm(['{"needsFollowUp":false}'])
    llm.delayMs = 50
    const ctrl = new AbortController()
    const p = generateStructured(llm, { messages, schema: Schema, name: 'f', signal: ctrl.signal })
    ctrl.abort()
    const err = await p.catch((e) => e)
    expect((err as LlmError).kind).toBe('aborted')
  })
})
