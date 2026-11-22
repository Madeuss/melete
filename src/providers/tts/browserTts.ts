import { beginSpeech, endSpeech, isCurrentSpeech } from './activeSpeech'
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

const stopBrowserSpeech = () => {
  if (isBrowserTtsSupported()) speechSynthesis.cancel()
}

export class BrowserTts implements TextToSpeech {
  private readonly lang: string
  private readonly voiceName?: string
  private readonly rate: number
  private speech = 0

  constructor(opts: { lang: string; voiceName?: string; rate?: number }) {
    this.lang = opts.lang
    this.voiceName = opts.voiceName
    this.rate = opts.rate ?? 1
  }

  async speak(text: string): Promise<void> {
    if (!isBrowserTtsSupported() || !text.trim()) return
    const speech = (this.speech = beginSpeech(stopBrowserSpeech))
    speechSynthesis.cancel()
    const voices = await loadVoices()
    const voice =
      voices.find((v) => v.name === this.voiceName) ?? voicesFor(voices, this.lang.slice(0, 2))[0] ?? undefined

    for (const sentence of splitSentences(text)) {
      if (!isCurrentSpeech(speech)) return
      await new Promise<void>((resolve) => {
        // Chrome sometimes never fires onend (and never does without voices): cap the wait
        // at a generous estimate of the sentence length so the interview can't get stuck.
        const words = sentence.split(/\s+/).length
        const cap = setTimeout(resolve, ((words / 2) * 1000) / this.rate + 3000)
        const done = () => {
          clearTimeout(cap)
          resolve()
        }
        const u = new SpeechSynthesisUtterance(sentence)
        u.lang = voice?.lang ?? this.lang
        if (voice) u.voice = voice
        u.rate = this.rate
        u.onend = done
        u.onerror = done // never block the interview on a TTS failure
        speechSynthesis.speak(u)
      })
    }
  }

  cancel(): void {
    // Only stops what this instance started; another reading may have taken over by now.
    endSpeech(this.speech)
  }
}

/** TTS turned off: questions are only shown. */
export class SilentTts implements TextToSpeech {
  speak(): Promise<void> {
    return Promise.resolve()
  }
  cancel(): void {}
}
