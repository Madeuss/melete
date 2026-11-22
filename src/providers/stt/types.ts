export type SttErrorKind = 'not-allowed' | 'no-microphone' | 'network' | 'unsupported' | 'unknown'

export class SttError extends Error {
  readonly kind: SttErrorKind
  constructor(kind: SttErrorKind, cause?: unknown) {
    super(`Speech recognition error: ${kind}`, { cause })
    this.name = 'SttError'
    this.kind = kind
  }
}

export interface SpeechToText {
  /** Starts listening. onPartial receives the full text so far (final + interim). */
  start(onPartial?: (text: string) => void, onError?: (err: SttError) => void): void
  /** Stops and resolves with the final transcript. */
  stop(): Promise<string>
  /** Stops without waiting for a result (leaving the room). */
  abort(): void
}
