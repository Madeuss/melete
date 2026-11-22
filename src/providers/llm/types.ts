export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LlmConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export type ResponseFormat =
  | { type: 'json_schema'; json_schema: { name: string; schema: object; strict?: boolean } }
  | { type: 'json_object' }

export interface ChatOptions {
  /** Sent as `response_format`. structuredOutput.ts decides which one (if any) to use. */
  responseFormat?: ResponseFormat
  signal?: AbortSignal
  temperature?: number
  maxTokens?: number
}

export interface LlmCapabilities {
  supportsJsonSchema: boolean
  supportsJsonObject: boolean
  /** Headers this provider needs on every call (e.g. Anthropic's browser-access header). */
  extraHeaders: Record<string, string>
}

export interface LlmProvider {
  readonly model: string
  readonly capabilities: LlmCapabilities
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string>
}
