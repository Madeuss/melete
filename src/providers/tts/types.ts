export interface TextToSpeech {
  /** Resolves when speech ends (or immediately when TTS is off or unavailable). */
  speak(text: string): Promise<void>
  cancel(): void
  /**
   * Hint that `text` will be spoken soon, so engines that generate audio (Kokoro) can do it
   * ahead of time. Optional and fire-and-forget.
   */
  prepare?(text: string): void
}
