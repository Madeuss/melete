/**
 * Provider errors normalized into a few kinds the UI can explain with a suggested action.
 * `detail` is the provider's own message, already redacted: it never contains the API key.
 */
export type LlmErrorKind =
  | 'auth' // 401/403: check the key
  | 'rate-limit' // 429: wait or check credits
  | 'not-found' // 404: wrong base URL or model
  | 'bad-request' // 400/422: model or parameter not supported
  | 'server' // 5xx
  | 'network' // fetch failed: offline, CORS, wrong URL
  | 'local-unreachable' // fetch failed against localhost: not running or origin not allowed
  | 'timeout'
  | 'aborted'
  | 'invalid-response' // 2xx but no usable content
  | 'invalid-output' // content didn't match the schema after retries

export class LlmError extends Error {
  readonly kind: LlmErrorKind
  readonly status?: number
  readonly detail?: string

  constructor(kind: LlmErrorKind, opts: { status?: number; detail?: string; cause?: unknown } = {}) {
    super(`LLM error: ${kind}${opts.status ? ` (${opts.status})` : ''}`, { cause: opts.cause })
    this.name = 'LlmError'
    this.kind = kind
    this.status = opts.status
    this.detail = opts.detail
  }
}

export function isAbortError(err: unknown): boolean {
  return (
    (err instanceof LlmError && err.kind === 'aborted') ||
    (err instanceof DOMException && err.name === 'AbortError')
  )
}

// Common key shapes: OpenAI/OpenRouter/Anthropic "sk-…", Groq "gsk_…", Google "AIza…", bearer tokens.
const KEY_PATTERNS = [/\bsk-[A-Za-z0-9_-]{6,}/g, /\bgsk_[A-Za-z0-9]{6,}/g, /\bAIza[A-Za-z0-9_-]{10,}/g, /Bearer\s+\S+/gi]

/** Removes the API key (and anything shaped like one) from text that may be shown or logged. */
export function redact(text: string, apiKey?: string): string {
  let out = text
  if (apiKey && apiKey.length >= 4) out = out.split(apiKey).join('[redacted]')
  for (const re of KEY_PATTERNS) out = out.replace(re, '[redacted]')
  return out
}

export function kindFromStatus(status: number): LlmErrorKind {
  if (status === 401 || status === 403) return 'auth'
  if (status === 429) return 'rate-limit'
  if (status === 404) return 'not-found'
  if (status === 400 || status === 422) return 'bad-request'
  if (status >= 500) return 'server'
  return 'bad-request'
}
