import type { SpeechToText } from './types'

/**
 * "Typed only" mode: no microphone. The answer comes from the text box in the room;
 * this implementation exists so the engine can always be given a SpeechToText.
 */
export class TypedStt implements SpeechToText {
  start(): void {}
  stop(): Promise<string> {
    return Promise.resolve('')
  }
  abort(): void {}
}
