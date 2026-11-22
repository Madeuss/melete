import { describe, expect, it, vi } from 'vitest'
import { LlmError, redact } from './errors'
import { OpenAiCompatibleProvider, endpoint, testConnection } from './openaiCompatible'
import { PRESETS } from './presets'

const KEY = 'sk-proj-abcdef1234567890'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function provider(fetchImpl: typeof fetch, baseUrl = 'https://api.openai.com/v1/', opts = {}) {
  return new OpenAiCompatibleProvider({ baseUrl, apiKey: KEY, model: 'm' }, PRESETS.openai.capabilities, {
    fetch: fetchImpl,
    ...opts,
  })
}

async function caught(p: Promise<unknown>): Promise<LlmError> {
  try {
    await p
  } catch (e) {
    if (e instanceof LlmError) return e
    throw e
  }
  throw new Error('expected rejection')
}

describe('endpoint', () => {
  it('joins without double slashes', () => {
    expect(endpoint('https://x.dev/v1/', 'chat/completions')).toBe('https://x.dev/v1/chat/completions')
    expect(endpoint('https://x.dev/v1', '/models')).toBe('https://x.dev/v1/models')
  })
})

describe('OpenAiCompatibleProvider.chat', () => {
  it('posts model, messages and response_format and returns the content', async () => {
    const f = vi.fn<typeof fetch>(async () => json({ choices: [{ message: { content: 'hi' } }] }))
    const out = await provider(f).chat([{ role: 'user', content: 'hello' }], {
      responseFormat: { type: 'json_object' },
    })
    expect(out).toBe('hi')
    const [url, init] = f.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
    expect(JSON.parse(String(init?.body))).toEqual({
      model: 'm',
      messages: [{ role: 'user', content: 'hello' }],
      response_format: { type: 'json_object' },
    })
    expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`)
  })

  it('sends preset extra headers and no Authorization when the key is empty', async () => {
    const f = vi.fn<typeof fetch>(async () => json({ choices: [{ message: { content: 'ok' } }] }))
    const p = new OpenAiCompatibleProvider(
      { baseUrl: 'http://localhost:1/v1', apiKey: '', model: 'm' },
      PRESETS.anthropic.capabilities,
      { fetch: f },
    )
    await p.chat([{ role: 'user', content: 'x' }])
    const headers = f.mock.calls[0][1]?.headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true')
  })

  it('maps 401 to auth and never leaks the key in the detail', async () => {
    const f = vi.fn<typeof fetch>(async () =>
      json({ error: { message: `Incorrect API key provided: ${KEY}. Bearer ${KEY}` } }, 401),
    )
    const err = await caught(provider(f).chat([{ role: 'user', content: 'x' }]))
    expect(err.kind).toBe('auth')
    expect(err.status).toBe(401)
    expect(err.detail).toContain('Incorrect API key')
    expect(JSON.stringify({ ...err, message: err.message, detail: err.detail })).not.toContain(KEY)
  })

  it('maps 429 to rate-limit and 500 to server', async () => {
    expect((await caught(provider(async () => json({}, 429)).chat([]))).kind).toBe('rate-limit')
    expect((await caught(provider(async () => new Response('oops', { status: 503 })).chat([]))).kind).toBe(
      'server',
    )
  })

  it('reports network vs local-unreachable when fetch throws', async () => {
    const boom = async () => {
      throw new TypeError('Failed to fetch')
    }
    expect((await caught(provider(boom).chat([]))).kind).toBe('network')
    expect((await caught(provider(boom, 'http://localhost:11434/v1').chat([]))).kind).toBe('local-unreachable')
  })

  it('reports aborted when the caller aborts', async () => {
    const ctrl = new AbortController()
    const f: typeof fetch = (_url, init) =>
      new Promise((_res, rej) => {
        init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))
      })
    const p = provider(f).chat([], { signal: ctrl.signal })
    ctrl.abort()
    expect((await caught(p)).kind).toBe('aborted')
  })

  it('reports timeout', async () => {
    const f: typeof fetch = (_url, init) =>
      new Promise((_res, rej) => {
        init?.signal?.addEventListener('abort', () => rej(new DOMException('timeout', 'TimeoutError')))
      })
    expect((await caught(provider(f, undefined, { timeoutMs: 10 }).chat([]))).kind).toBe('timeout')
  })

  it('rejects a 200 without content', async () => {
    const f = async () => json({ choices: [{ message: { content: null } }] })
    expect((await caught(provider(f).chat([]))).kind).toBe('invalid-response')
  })
})

describe('listModels and testConnection', () => {
  it('lists model ids, stripping the Gemini "models/" prefix', async () => {
    const f = async () => json({ data: [{ id: 'models/gemini-x' }, { id: 'a' }] })
    expect(await provider(f).listModels()).toEqual(['a', 'gemini-x'])
  })

  it('testConnection resolves on a minimal successful call', async () => {
    const f = vi.fn<typeof fetch>(async () => json({ choices: [{ message: { content: 'ok' } }] }))
    await expect(testConnection(provider(f))).resolves.toBeUndefined()
    expect(f).toHaveBeenCalledTimes(1)
  })
})

describe('redact', () => {
  it('removes the configured key and key-shaped strings', () => {
    expect(redact(`a ${KEY} b`, KEY)).toBe('a [redacted] b')
    expect(redact('gsk_abcdefghij and AIzaSyA1234567890abc')).toBe('[redacted] and [redacted]')
  })
})
