import type { SpeechToText, SttError } from '../stt/types'

/** Test double: returns a fixed transcript on stop(). */
export class FakeStt implements SpeechToText {
  started = 0
  aborted = 0
  private onPartial?: (text: string) => void
  private onError?: (err: SttError) => void
  transcript: string

  constructor(transcript = '') {
    this.transcript = transcript
  }

  start(onPartial?: (text: string) => void, onError?: (err: SttError) => void): void {
    this.started++
    this.onPartial = onPartial
    this.onError = onError
  }

  /** Simulate live recognition. */
  emitPartial(text: string) {
    this.onPartial?.(text)
  }

  emitError(err: SttError) {
    this.onError?.(err)
  }

  stop(): Promise<string> {
    return Promise.resolve(this.transcript)
  }

  abort(): void {
    this.aborted++
  }
}
