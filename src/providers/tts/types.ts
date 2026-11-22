export interface TextToSpeech {
  /** Resolves when speech ends (or immediately when TTS is off or unavailable). */
  speak(text: string): Promise<void>
  cancel(): void
}
