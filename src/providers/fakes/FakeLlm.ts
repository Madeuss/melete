import type { ChatMessage, ChatOptions, ChatResult, LlmCapabilities, LlmProvider, TokenUsage } from '../llm/types'

type Reply = string | Error | ((messages: ChatMessage[], opts: ChatOptions) => string | Promise<string>)

export interface FakeLlmCall {
  messages: ChatMessage[]
  opts: ChatOptions
}

/**
 * Test double for LlmProvider: returns queued replies in order (or a router function),
 * records every call, and honors AbortSignal like a real provider. No network.
 */
export class FakeLlm implements LlmProvider {
  readonly model: string
  readonly capabilities: LlmCapabilities
  readonly calls: FakeLlmCall[] = []
  private queue: Reply[]
  private router?: (messages: ChatMessage[], opts: ChatOptions) => Reply
  /** Delay before replying, to test cancellation. */
  delayMs = 0
  /** Usage reported with every reply; undefined = a provider that doesn't report it. */
  usage?: TokenUsage

  constructor(
    replies: Reply[] = [],
    capabilities: Partial<LlmCapabilities> = {},
    model = 'fake-model',
  ) {
    this.queue = [...replies]
    this.model = model
    this.capabilities = { supportsJsonSchema: false, supportsJsonObject: false, extraHeaders: {}, ...capabilities }
  }

  /** Answer based on the request instead of a fixed queue (used by the engine tests). */
  route(fn: (messages: ChatMessage[], opts: ChatOptions) => Reply): this {
    this.router = fn
    return this
  }

  push(...replies: Reply[]): this {
    this.queue.push(...replies)
    return this
  }

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
    this.calls.push({ messages: structuredClone(messages), opts: { ...opts, signal: undefined } })
    if (this.delayMs > 0 || opts.signal) {
      await new Promise<void>((resolve, reject) => {
        if (opts.signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
        const t = setTimeout(resolve, this.delayMs)
        opts.signal?.addEventListener('abort', () => {
          clearTimeout(t)
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })
    }
    const reply = this.router ? this.router(messages, opts) : this.queue.shift()
    if (reply === undefined) throw new Error('FakeLlm: no reply queued')
    if (reply instanceof Error) throw reply
    const content = typeof reply === 'function' ? await reply(messages, opts) : reply
    return this.usage ? { content, usage: { ...this.usage } } : { content }
  }
}
