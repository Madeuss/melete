import { afterEach, describe, expect, it, vi } from 'vitest'
import { WebSpeechStt, isWebSpeechSupported } from './stt/webSpeech'
import { splitSentences, voicesFor } from './tts/browserTts'

class MockRecognition {
  static last: MockRecognition
  lang = ''
  continuous = false
  interimResults = false
  onresult: ((e: unknown) => void) | null = null
  onerror: ((e: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  starts = 0
  constructor() {
    MockRecognition.last = this
  }
  start() {
    this.starts++
  }
  stop() {
    queueMicrotask(() => this.onend?.())
  }
  abort() {}
  emit(results: Array<[string, boolean]>, resultIndex = 0) {
    const list = results.map(([t, isFinal]) => ({ isFinal, 0: { transcript: t }, length: 1 }))
    this.onresult?.({ resultIndex, results: list })
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('WebSpeechStt', () => {
  it('reports unsupported when the API is missing', () => {
    expect(isWebSpeechSupported()).toBe(false)
    const onError = vi.fn()
    new WebSpeechStt('en-US').start(undefined, onError)
    expect(onError.mock.calls[0][0].kind).toBe('unsupported')
  })

  it('streams partial text and resolves the final transcript on stop', async () => {
    vi.stubGlobal('webkitSpeechRecognition', MockRecognition)
    const stt = new WebSpeechStt('en-US')
    const partials: string[] = []
    stt.start((t) => partials.push(t))
    const rec = MockRecognition.last
    expect(rec.lang).toBe('en-US')
    expect(rec.continuous).toBe(true)

    rec.emit([['I led the', false]])
    rec.emit([['I led the migration', true]])
    rec.emit([['I led the migration', true], ['to React', false]], 1)
    expect(partials.at(-1)).toBe('I led the migration to React')
    await expect(stt.stop()).resolves.toBe('I led the migration to React')
  })

  it('restarts after a silence and keeps the interim text', async () => {
    vi.stubGlobal('SpeechRecognition', MockRecognition)
    const stt = new WebSpeechStt('en-US')
    stt.start()
    const rec = MockRecognition.last
    rec.emit([['first part', false]])
    rec.onerror?.({ error: 'no-speech' })
    rec.onend?.()
    expect(rec.starts).toBe(2)
    rec.emit([['second part', true]])
    await expect(stt.stop()).resolves.toBe('first part second part')
  })

  it('maps permission errors', () => {
    vi.stubGlobal('SpeechRecognition', MockRecognition)
    const onError = vi.fn()
    new WebSpeechStt('en-US').start(undefined, onError)
    MockRecognition.last.onerror?.({ error: 'not-allowed' })
    expect(onError.mock.calls[0][0].kind).toBe('not-allowed')
  })
})

describe('browser TTS helpers', () => {
  it('splits sentences', () => {
    expect(splitSentences('Tell me about a time. What did you do? Great')).toEqual([
      'Tell me about a time.',
      'What did you do?',
      'Great',
    ])
  })

  it('filters voices by language, local first', () => {
    const v = (name: string, lang: string, localService: boolean) => ({ name, lang, localService }) as SpeechSynthesisVoice
    const out = voicesFor([v('B', 'en-GB', false), v('X', 'pt-BR', true), v('A', 'en-US', true)], 'en')
    expect(out.map((x) => x.name)).toEqual(['A', 'B'])
  })
})
