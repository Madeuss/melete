/*
 * Kokoro (https://huggingface.co/hexgrad/Kokoro-82M) is an open speech model small enough to run
 * in the browser. kokoro-js only handles English; the worker adds Brazilian Portuguese the way
 * Kokoro's own pipeline does for other languages (espeak-ng phonemes).
 *
 * This file must not import kokoro-js: it's used on the main thread, and the library (with the
 * model runtime) only loads inside the worker.
 */
import type { InterviewLanguage } from '../../../schemas'

export const KOKORO_MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX'

export type KokoroDevice = 'webgpu' | 'wasm'

/**
 * Where the model runs and which weights it uses. Measured on a desktop (first sentence of the sample):
 * - webgpu + fp32: ~0.5 s per sentence once warmed up, but a bigger download.
 * - wasm + q8: ~5 s per sentence (slower than speech), smaller download. Used without WebGPU.
 * fp16 and q4f16 on WebGPU are fast but produce NaN (silence), so they're not options.
 * sizeMb includes the ONNX runtime (~21 MB) the app serves.
 */
export const KOKORO_VARIANTS = {
  webgpu: { dtype: 'fp32', file: 'onnx/model.onnx', sizeMb: 350 },
  wasm: { dtype: 'q8', file: 'onnx/model_quantized.onnx', sizeMb: 110 },
} as const satisfies Record<KokoroDevice, { dtype: string; file: string; sizeMb: number }>

export interface KokoroVoice {
  id: string
  name: string
  language: InterviewLanguage
  accent: 'us' | 'gb' | 'br'
  gender: 'female' | 'male'
}

/**
 * English: the voices graded C or better by Kokoro's authors, best first within each accent.
 * Portuguese: Kokoro's two Brazilian voices (its third, "Santa", is a novelty voice).
 */
export const KOKORO_VOICES: readonly KokoroVoice[] = [
  { id: 'af_heart', name: 'Heart', language: 'en', accent: 'us', gender: 'female' },
  { id: 'af_bella', name: 'Bella', language: 'en', accent: 'us', gender: 'female' },
  { id: 'af_nicole', name: 'Nicole', language: 'en', accent: 'us', gender: 'female' },
  { id: 'af_aoede', name: 'Aoede', language: 'en', accent: 'us', gender: 'female' },
  { id: 'af_kore', name: 'Kore', language: 'en', accent: 'us', gender: 'female' },
  { id: 'af_sarah', name: 'Sarah', language: 'en', accent: 'us', gender: 'female' },
  { id: 'am_michael', name: 'Michael', language: 'en', accent: 'us', gender: 'male' },
  { id: 'am_fenrir', name: 'Fenrir', language: 'en', accent: 'us', gender: 'male' },
  { id: 'am_puck', name: 'Puck', language: 'en', accent: 'us', gender: 'male' },
  { id: 'bf_emma', name: 'Emma', language: 'en', accent: 'gb', gender: 'female' },
  { id: 'bf_isabella', name: 'Isabella', language: 'en', accent: 'gb', gender: 'female' },
  { id: 'bm_george', name: 'George', language: 'en', accent: 'gb', gender: 'male' },
  { id: 'bm_fable', name: 'Fable', language: 'en', accent: 'gb', gender: 'male' },
  { id: 'pf_dora', name: 'Dora', language: 'pt', accent: 'br', gender: 'female' },
  { id: 'pm_alex', name: 'Alex', language: 'pt', accent: 'br', gender: 'male' },
]

const DEFAULT_VOICE: Record<InterviewLanguage, string> = { en: 'af_heart', pt: 'pf_dora' }

export function kokoroVoicesFor(language: InterviewLanguage): KokoroVoice[] {
  return KOKORO_VOICES.filter((v) => v.language === language)
}

/** The saved voice if it's a Kokoro voice for this language, otherwise the language's default. */
export function kokoroVoiceOrDefault(id: string | undefined, language: InterviewLanguage): string {
  return kokoroVoicesFor(language).some((v) => v.id === id) ? id! : DEFAULT_VOICE[language]
}

/** Kokoro voice ids start with a language letter: a/b = English, p = Brazilian Portuguese. */
export function isPortugueseVoice(id: string): boolean {
  return id.startsWith('p')
}
