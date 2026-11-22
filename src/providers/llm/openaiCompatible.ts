import { z } from 'zod'
import { LlmError, kindFromStatus, redact } from './errors'
import { getPreset, isLocalUrl } from './presets'
import type { ChatMessage, ChatOptions, ChatResult, LlmCapabilities, LlmConfig, LlmProvider, TokenUsage } from './types'

const DEFAULT_TIMEOUT_MS = 90_000

const ChatResponse = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().nullable().optional() }),
      }),
    )
    .min(1),
})

/** Read on its own: a missing or odd `usage` must never break the call. */
const UsageBody = z.object({
  usage: z.object({ prompt_tokens: z.number().int().min(0), completion_tokens: z.number().int().min(0) }),
})

function usageOf(json: unknown): TokenUsage | undefined {
  const parsed = UsageBody.safeParse(json)
  if (!parsed.success) return undefined
  return { promptTokens: parsed.data.usage.prompt_tokens, completionTokens: parsed.data.usage.completion_tokens }
}

const ModelsResponse = z.object({
  data: z.array(z.object({ id: z.string() })),
})

const ErrorBody = z.union([
  z.object({ error: z.object({ message: z.string() }) }),
  z.object({ error: z.string() }),
  z.array(z.object({ error: z.object({ message: z.string() }) })), // Gemini sometimes wraps in an array
])

export function endpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

function combineSignals(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

async function readErrorDetail(res: Response, apiKey: string): Promise<string | undefined> {
  try {
    const text = await res.text()
    const parsed = ErrorBody.safeParse(JSON.parse(text))
    let message = text
    if (parsed.success) {
      const b = parsed.data
      message = Array.isArray(b) ? b[0].error.message : typeof b.error === 'string' ? b.error : b.error.message
    }
    return redact(message.slice(0, 500), apiKey)
  } catch {
    return undefined
  }
}

/**
 * The single LLM client: any API that speaks `POST {baseUrl}/chat/completions`.
 * Calls go straight from the browser to the provider; nothing passes through a project server.
 */
export class OpenAiCompatibleProvider implements LlmProvider {
  readonly model: string
  readonly capabilities: LlmCapabilities
  private readonly config: LlmConfig
  private readonly timeoutMs: number
  private readonly fetchImpl: typeof fetch

  constructor(
    config: LlmConfig,
    capabilities: LlmCapabilities,
    opts: { timeoutMs?: number; fetch?: typeof fetch } = {},
  ) {
    this.config = config
    this.model = config.model
    this.capabilities = capabilities
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.fetchImpl = opts.fetch ?? ((...args) => globalThis.fetch(...args))
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json', ...this.capabilities.extraHeaders }
    if (this.config.apiKey) h.Authorization = `Bearer ${this.config.apiKey}`
    return h
  }

  private async request(path: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
    const url = endpoint(this.config.baseUrl, path)
    const combined = combineSignals(signal, this.timeoutMs)
    let res: Response
    try {
      res = await this.fetchImpl(url, { ...init, headers: this.headers(), signal: combined })
    } catch (err) {
      if (signal?.aborted) throw new LlmError('aborted', { cause: err })
      if (combined.aborted) throw new LlmError('timeout', { cause: err })
      // fetch() hides the reason (CORS, DNS, offline, refused) behind a TypeError.
      throw new LlmError(isLocalUrl(this.config.baseUrl) ? 'local-unreachable' : 'network')
    }
    if (!res.ok) {
      const detail = await readErrorDetail(res, this.config.apiKey)
      throw new LlmError(kindFromStatus(res.status), { status: res.status, detail })
    }
    return res
  }

  /** Not streamed, so `usage` comes in the response body (no `stream_options` needed). */
  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
    const body: Record<string, unknown> = { model: this.config.model, messages }
    if (opts.responseFormat) body.response_format = opts.responseFormat
    if (opts.temperature !== undefined) body.temperature = opts.temperature
    if (opts.maxTokens !== undefined) body.max_tokens = opts.maxTokens

    const res = await this.request('chat/completions', { method: 'POST', body: JSON.stringify(body) }, opts.signal)
    let json: unknown
    try {
      json = await res.json()
    } catch {
      throw new LlmError('invalid-response', { detail: 'Response was not JSON' })
    }
    const parsed = ChatResponse.safeParse(json)
    const content = parsed.success ? parsed.data.choices[0].message.content : undefined
    if (!content) throw new LlmError('invalid-response', { detail: 'No message content in the response' })
    const usage = usageOf(json)
    return usage ? { content, usage } : { content }
  }

  /** GET {baseUrl}/models, used to suggest model names. Not all providers support it. */
  async listModels(signal?: AbortSignal): Promise<string[]> {
    const res = await this.request('models', { method: 'GET' }, signal)
    const parsed = ModelsResponse.safeParse(await res.json().catch(() => null))
    if (!parsed.success) return []
    return parsed.data.data.map((m) => m.id.replace(/^models\//, '')).sort()
  }
}

/**
 * "Test connection": the smallest possible chat call. Resolves on success,
 * throws LlmError otherwise (the UI maps the kind to a message and an action).
 */
export async function testConnection(provider: LlmProvider, signal?: AbortSignal): Promise<void> {
  // No max_tokens: reasoning models reject it (they want max_completion_tokens) or spend it all thinking.
  await provider.chat([{ role: 'user', content: 'Reply with the single word: ok' }], { signal })
}

/** Builds the provider from saved settings, using the preset's capabilities. */
export function createLlmProvider(llm: LlmConfig & { preset: string }): OpenAiCompatibleProvider {
  return new OpenAiCompatibleProvider(
    { baseUrl: llm.baseUrl, apiKey: llm.apiKey, model: llm.model },
    getPreset(llm.preset).capabilities,
  )
}
