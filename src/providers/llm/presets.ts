import type { LlmCapabilities } from './types'

export type PresetId = 'openai' | 'openrouter' | 'groq' | 'gemini' | 'anthropic' | 'ollama' | 'lmstudio' | 'custom'

export interface CorsCheck {
  /** ok = the browser can call it directly; needs-setup = the user must allow the app's origin. */
  status: 'ok' | 'needs-setup' | 'unknown'
  /** When and how it was verified. */
  checkedAt?: string
  how?: string
}

export interface LlmPreset {
  id: PresetId
  /** Display name (brand names are not translated). */
  name: string
  baseUrl: string
  /** Suggested model; the user can type any other or load the provider's list. */
  defaultModel: string
  requiresKey: boolean
  local: boolean
  capabilities: LlmCapabilities
  cors: CorsCheck
  /** Where to get a key / docs, shown next to the key field. */
  keyUrl?: string
}

const PREFLIGHT = 'OPTIONS preflight with Origin + Authorization/Content-Type, 2026-11-22'

/*
 * Capabilities are deliberately conservative: when a provider's support for json_schema
 * depends on the model, we claim only json_object. structuredOutput.ts also downgrades
 * automatically if a provider rejects response_format with a 400.
 */
export const PRESETS: Record<PresetId, LlmPreset> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4.1-mini',
    requiresKey: true,
    local: false,
    capabilities: { supportsJsonSchema: true, supportsJsonObject: true, extraHeaders: {} },
    cors: { status: 'ok', checkedAt: '2026-11-22', how: PREFLIGHT },
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4.1-mini',
    requiresKey: true,
    local: false,
    // X-Title is in OpenRouter's allowed CORS headers and shows "melete" in their dashboard.
    capabilities: { supportsJsonSchema: false, supportsJsonObject: true, extraHeaders: { 'X-Title': 'melete' } },
    cors: { status: 'ok', checkedAt: '2026-11-22', how: PREFLIGHT },
    keyUrl: 'https://openrouter.ai/keys',
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    requiresKey: true,
    local: false,
    capabilities: { supportsJsonSchema: false, supportsJsonObject: true, extraHeaders: {} },
    cors: { status: 'ok', checkedAt: '2026-11-22', how: PREFLIGHT },
    keyUrl: 'https://console.groq.com/keys',
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.5-flash',
    requiresKey: true,
    local: false,
    // Gemini's preflight rejects unknown headers (403), so never add extras here.
    capabilities: { supportsJsonSchema: true, supportsJsonObject: true, extraHeaders: {} },
    cors: { status: 'ok', checkedAt: '2026-11-22', how: PREFLIGHT },
    keyUrl: 'https://aistudio.google.com/apikey',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-haiku-5-5',
    requiresKey: true,
    local: false,
    // The OpenAI-compatible endpoint ignores response_format: prompt-only JSON.
    capabilities: {
      supportsJsonSchema: false,
      supportsJsonObject: false,
      extraHeaders: { 'anthropic-dangerous-direct-browser-access': 'true' },
    },
    cors: { status: 'ok', checkedAt: '2026-11-22', how: PREFLIGHT },
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'qwen3:8b',
    requiresKey: false,
    local: true,
    capabilities: { supportsJsonSchema: false, supportsJsonObject: true, extraHeaders: {} },
    cors: { status: 'needs-setup', how: 'Set OLLAMA_ORIGINS to the app origin and restart Ollama' },
    keyUrl: 'https://ollama.com/download',
  },
  lmstudio: {
    id: 'lmstudio',
    name: 'LM Studio',
    baseUrl: 'http://localhost:1234/v1',
    defaultModel: '',
    requiresKey: false,
    local: true,
    // LM Studio accepts json_schema but rejects { type: "json_object" }.
    capabilities: { supportsJsonSchema: true, supportsJsonObject: false, extraHeaders: {} },
    cors: { status: 'needs-setup', how: 'Turn on "Enable CORS" in the LM Studio server settings' },
    keyUrl: 'https://lmstudio.ai',
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    baseUrl: '',
    defaultModel: '',
    requiresKey: false,
    local: false,
    capabilities: { supportsJsonSchema: false, supportsJsonObject: false, extraHeaders: {} },
    cors: { status: 'unknown' },
  },
}

export const PRESET_ORDER: PresetId[] = [
  'openai',
  'openrouter',
  'groq',
  'gemini',
  'anthropic',
  'ollama',
  'lmstudio',
  'custom',
]

export function getPreset(id: string): LlmPreset {
  return (PRESETS as Record<string, LlmPreset>)[id] ?? PRESETS.custom
}

export function isLocalUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.local')
  } catch {
    return false
  }
}
