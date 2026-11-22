import { z } from 'zod'
import { LlmError, isAbortError } from './errors'
import type { ChatMessage, LlmProvider, ResponseFormat } from './types'

/*
 * Structured output on top of any OpenAI-compatible provider:
 *   1. json_schema response_format when the preset supports it;
 *   2. else json_object;
 *   3. else only a prompt instruction + extraction of the first JSON object.
 *   4. Validate with Zod; on failure, retry up to 2 times sending the validation error back.
 * If the provider rejects response_format itself (HTTP 400), we drop to the next mode
 * without spending a validation retry.
 */

export type JsonMode = 'json_schema' | 'json_object' | 'prompt'

export function pickMode(caps: { supportsJsonSchema: boolean; supportsJsonObject: boolean }): JsonMode {
  if (caps.supportsJsonSchema) return 'json_schema'
  if (caps.supportsJsonObject) return 'json_object'
  return 'prompt'
}

function nextMode(mode: JsonMode, caps: { supportsJsonObject: boolean }): JsonMode | undefined {
  if (mode === 'json_schema') return caps.supportsJsonObject ? 'json_object' : 'prompt'
  if (mode === 'json_object') return 'prompt'
  return undefined
}

export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: 'draft-7', unrepresentable: 'any' }) as Record<string, unknown>
  delete json.$schema
  return json
}

function responseFormatFor(mode: JsonMode, name: string, jsonSchema: object): ResponseFormat | undefined {
  if (mode === 'json_schema') return { type: 'json_schema', json_schema: { name, schema: jsonSchema, strict: false } }
  if (mode === 'json_object') return { type: 'json_object' }
  return undefined
}

/** Instruction added to every request (json_object mode on OpenAI even requires the word "JSON"). */
export function jsonInstruction(jsonSchema: object): string {
  return [
    'Respond with a single JSON object and nothing else: no prose, no markdown fences.',
    'It must validate against this JSON Schema:',
    JSON.stringify(jsonSchema),
  ].join('\n')
}

/**
 * Finds the first complete JSON object in a model reply. Handles markdown fences,
 * <think> blocks from reasoning models and prose around the object.
 */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    // fall through to scanning
  }
  for (let start = cleaned.indexOf('{'); start !== -1; start = cleaned.indexOf('{', start + 1)) {
    let depth = 0
    let inString = false
    let escaped = false
    for (let i = start; i < cleaned.length; i++) {
      const ch = cleaned[i]
      if (inString) {
        if (escaped) escaped = false
        else if (ch === '\\') escaped = true
        else if (ch === '"') inString = false
        continue
      }
      if (ch === '"') inString = true
      else if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) {
          try {
            return JSON.parse(cleaned.slice(start, i + 1))
          } catch {
            break // not valid JSON from this start; try the next "{"
          }
        }
      }
    }
  }
  throw new SyntaxError('No JSON object found in the reply')
}

function withJsonInstruction(messages: ChatMessage[], instruction: string): ChatMessage[] {
  const [first, ...rest] = messages
  if (first?.role === 'system') return [{ role: 'system', content: `${first.content}\n\n${instruction}` }, ...rest]
  return [{ role: 'system', content: instruction }, ...messages]
}

function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 10)
    .map((i) => `- ${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`)
    .join('\n')
}

export interface StructuredRequest<T> {
  messages: ChatMessage[]
  schema: z.ZodType<T>
  /** Name for json_schema mode (letters, digits, _ and -). */
  name: string
  signal?: AbortSignal
  /** Validation retries after the first attempt. Default 2. */
  maxRetries?: number
  temperature?: number
}

export async function generateStructured<T>(llm: LlmProvider, req: StructuredRequest<T>): Promise<T> {
  const maxRetries = req.maxRetries ?? 2
  const jsonSchema = toJsonSchema(req.schema)
  let mode: JsonMode = pickMode(llm.capabilities)

  // The instruction is merged into the first system message: some compatible endpoints
  // (Anthropic, Gemini) only honor a single leading system message.
  const messages: ChatMessage[] = withJsonInstruction(req.messages, jsonInstruction(jsonSchema))
  let lastProblem = ''

  for (let attempt = 0; attempt <= maxRetries; ) {
    let raw: string
    try {
      raw = (
        await llm.chat(messages, {
          responseFormat: responseFormatFor(mode, req.name, jsonSchema),
          signal: req.signal,
          temperature: req.temperature,
        })
      ).content
    } catch (err) {
      if (isAbortError(err)) throw err instanceof LlmError ? err : new LlmError('aborted', { cause: err })
      const downgrade = err instanceof LlmError && err.kind === 'bad-request' ? nextMode(mode, llm.capabilities) : undefined
      if (downgrade) {
        mode = downgrade
        continue // same attempt, simpler mode
      }
      throw err
    }

    let problem: string
    try {
      const result = req.schema.safeParse(extractJson(raw))
      if (result.success) return result.data
      problem = `The JSON did not match the schema:\n${describeIssues(result.error)}`
    } catch {
      problem = 'The reply was not a valid JSON object.'
    }

    lastProblem = problem
    attempt++
    if (attempt > maxRetries) break
    messages.push(
      { role: 'assistant', content: raw },
      { role: 'user', content: `${problem}\nReply again with only the corrected JSON object.` },
    )
  }

  throw new LlmError('invalid-output', { detail: lastProblem })
}
