import type { TextToSpeech } from '../tts/types'

/** Test double: records what would be spoken. */
export class FakeTts implements TextToSpeech {
  readonly spoken: string[] = []
  cancelled = 0

  speak(text: string): Promise<void> {
    this.spoken.push(text)
    return Promise.resolve()
  }

  cancel(): void {
    this.cancelled++
  }
}
