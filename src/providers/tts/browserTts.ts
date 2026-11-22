import type { TextToSpeech } from './types'

export function isBrowserTtsSupported(): boolean {
  return typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined'
}

/** Voices load asynchronously in Chrome; wait for them (up to 1.5s). */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!isBrowserTtsSupported()) return Promise.resolve([])
  const now = speechSynthesis.getVoices()
  if (now.length) return Promise.resolve(now)
  return new Promise((resolve) => {
    const done = () => {
      speechSynthesis.removeEventListener('voiceschanged', done)
      resolve(speechSynthesis.getVoices())
    }
    speechSynthesis.addEventListener('voiceschanged', done)
    setTimeout(done, 1500)
  })
}

/** Voices for a language prefix ("en", "pt"), local voices first. */
export function voicesFor(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice[] {
  return voices
    .filter((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase()))
    .sort((a, b) => Number(b.localService) - Number(a.localService) || a.name.localeCompare(b.name))
}

/** Splits text into sentences: Chrome cuts long utterances off after ~15 seconds. */
export function splitSentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [text]).map((s) => s.trim()).filter(Boolean)
}

export class BrowserTts implements TextToSpeech {
  private readonly lang: string
  private readonly voiceName?: string
  private readonly rate: number
  private cancelled = false

  constructor(opts: { lang: string; voiceName?: string; rate?: number }) {
    this.lang = opts.lang
    this.voiceName = opts.voiceName
    this.rate = opts.rate ?? 1
  }

  async speak(text: string): Promise<void> {
    if (!isBrowserTtsSupported() || !text.trim()) return
    this.cancelled = false
    speechSynthesis.cancel()
    const voices = await loadVoices()
    const voice =
      voices.find((v) => v.name === this.voiceName) ?? voicesFor(voices, this.lang.slice(0, 2))[0] ?? undefined

    for (const sentence of splitSentences(text)) {
      if (this.cancelled) return
      await new Promise<void>((resolve) => {
        const u = new SpeechSynthesisUtterance(sentence)
        u.lang = voice?.lang ?? this.lang
        if (voice) u.voice = voice
        u.rate = this.rate
        u.onend = () => resolve()
        u.onerror = () => resolve() // never block the interview on a TTS failure
        speechSynthesis.speak(u)
      })
    }
  }

  cancel(): void {
    this.cancelled = true
    if (isBrowserTtsSupported()) speechSynthesis.cancel()
  }
}

/** TTS turned off: questions are only shown. */
export class SilentTts implements TextToSpeech {
  speak(): Promise<void> {
    return Promise.resolve()
  }
  cancel(): void {}
}
