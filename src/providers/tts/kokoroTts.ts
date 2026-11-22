import { beginSpeech, endSpeech, isCurrentSpeech } from './activeSpeech'
import { splitSentences } from './browserTts'
import type { KokoroAudio } from './kokoro/client'
import type { AudioPlayer } from './kokoro/player'
import type { TextToSpeech } from './types'

export interface KokoroTtsOptions {
  synthesize: (sentence: string) => Promise<KokoroAudio>
  player: AudioPlayer
  /** Reads whatever is left if Kokoro fails (download error, out of memory, old browser). */
  fallback: TextToSpeech
}

/**
 * Reads text with Kokoro, sentence by sentence: the next sentence is generated while the current
 * one plays, so only the first sentence's generation time is felt as a pause.
 */
export class KokoroTts implements TextToSpeech {
  private readonly opts: KokoroTtsOptions
  private speech = 0
  /** Sentences generated ahead of time by prepare(), used once by speak(). */
  private readonly prepared = new Map<string, Promise<KokoroAudio>>()

  constructor(opts: KokoroTtsOptions) {
    this.opts = opts
  }

  prepare(text: string): void {
    if (this.prepared.size > 20) this.prepared.clear() // never needed; just a bound
    for (const sentence of splitSentences(text)) {
      if (this.prepared.has(sentence)) continue
      const audio = this.opts.synthesize(sentence)
      audio.catch(() => {}) // speak() regenerates (or falls back) if it's ever used
      this.prepared.set(sentence, audio)
    }
  }

  private synthesize(sentence: string): Promise<KokoroAudio> {
    const ready = this.prepared.get(sentence)
    if (!ready) return this.opts.synthesize(sentence)
    this.prepared.delete(sentence)
    return ready.catch(() => this.opts.synthesize(sentence))
  }

  async speak(text: string): Promise<void> {
    const sentences = splitSentences(text)
    if (!text.trim() || sentences.length === 0) return
    const speech = (this.speech = beginSpeech(() => this.opts.player.stop()))
    let i = 0
    try {
      let next = this.synthesize(sentences[0])
      for (; i < sentences.length; i++) {
        const audio = await next
        if (!isCurrentSpeech(speech)) return
        if (i + 1 < sentences.length) {
          next = this.synthesize(sentences[i + 1])
          next.catch(() => {}) // handled when awaited; avoids an unhandled rejection if we stop first
        }
        await this.opts.player.play(audio.samples, audio.sampleRate)
        if (!isCurrentSpeech(speech)) return
      }
    } catch {
      if (!isCurrentSpeech(speech)) return
      endSpeech(speech)
      await this.opts.fallback.speak(sentences.slice(i).join(' '))
    }
  }

  cancel(): void {
    endSpeech(this.speech)
    this.opts.fallback.cancel()
  }
}
