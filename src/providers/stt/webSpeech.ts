import { SttError, type SpeechToText, type SttErrorKind } from './types'

/*
 * Browser speech recognition (Web Speech API). In Chrome the audio is sent to Google's
 * servers — the settings screen warns about it. Not available in Firefox, and often
 * missing in Chromium builds (e.g. on Linux): typed answers are always available.
 */

interface RecognitionAlternative {
  transcript: string
}
interface RecognitionResult {
  isFinal: boolean
  0: RecognitionAlternative
  length: number
}
interface RecognitionEvent {
  resultIndex: number
  results: ArrayLike<RecognitionResult>
}
interface RecognitionErrorEvent {
  error: string
}
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: RecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionCtor = new () => Recognition

function getCtor(): RecognitionCtor | undefined {
  const w = globalThis as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export function isWebSpeechSupported(): boolean {
  return getCtor() !== undefined
}

function errorKind(code: string): SttErrorKind {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'not-allowed'
  if (code === 'audio-capture') return 'no-microphone'
  if (code === 'network') return 'network'
  return 'unknown'
}

export class WebSpeechStt implements SpeechToText {
  private readonly lang: string
  private recognition?: Recognition
  private finals: string[] = []
  private interim = ''
  private active = false
  private resolveStop?: (text: string) => void

  /** lang as BCP 47, e.g. "en-US" or "pt-BR". */
  constructor(lang: string) {
    this.lang = lang
  }

  private text(): string {
    return [...this.finals, this.interim].join(' ').replace(/\s+/g, ' ').trim()
  }

  start(onPartial?: (text: string) => void, onError?: (err: SttError) => void): void {
    const Ctor = getCtor()
    if (!Ctor) {
      onError?.(new SttError('unsupported'))
      return
    }
    this.finals = []
    this.interim = ''
    this.active = true

    const rec = new Ctor()
    rec.lang = this.lang
    rec.continuous = true
    rec.interimResults = true

    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) this.finals.push(r[0].transcript.trim())
        else interim += r[0].transcript
      }
      this.interim = interim.trim()
      onPartial?.(this.text())
    }

    rec.onerror = (e) => {
      // "no-speech" and "aborted" are normal pauses; the onend handler restarts.
      if (e.error === 'no-speech' || e.error === 'aborted') return
      this.active = false
      onError?.(new SttError(errorKind(e.error)))
    }

    rec.onend = () => {
      if (this.resolveStop) {
        const resolve = this.resolveStop
        this.resolveStop = undefined
        resolve(this.text())
        return
      }
      // Chrome ends the session after a silence even in continuous mode: keep listening
      // until the user presses stop. Keep the interim text as final so nothing is lost.
      if (this.active) {
        if (this.interim) {
          this.finals.push(this.interim)
          this.interim = ''
        }
        try {
          rec.start()
        } catch {
          this.active = false
        }
      }
    }

    this.recognition = rec
    rec.start()
  }

  stop(): Promise<string> {
    const rec = this.recognition
    this.active = false
    if (!rec) return Promise.resolve(this.text())
    return new Promise((resolve) => {
      this.resolveStop = resolve
      rec.stop()
      // Safety net: some browsers never fire onend after stop().
      setTimeout(() => {
        if (this.resolveStop === resolve) {
          this.resolveStop = undefined
          resolve(this.text())
        }
      }, 2500)
    })
  }

  abort(): void {
    this.active = false
    this.resolveStop = undefined
    this.recognition?.abort()
    this.recognition = undefined
  }
}
