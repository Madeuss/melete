/*
 * Kokoro (https://huggingface.co/hexgrad/Kokoro-82M) is an open speech model small enough to run
 * in the browser. Only English is supported by kokoro-js's phonemizer.
 *
 * This file must not import kokoro-js: it's used on the main thread, and the library (with the
 * model runtime) only loads inside the worker.
 */

export const KOKORO_MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX'
/** q8 weights: ~90 MB to download once, good quality on CPU (wasm). */
export const KOKORO_DTYPE = 'q8'

export interface KokoroVoice {
  id: string
  name: string
  accent: 'us' | 'gb'
  gender: 'female' | 'male'
}

/** The voices graded C or better by Kokoro's authors, best first within each accent. */
export const KOKORO_VOICES: readonly KokoroVoice[] = [
  { id: 'af_heart', name: 'Heart', accent: 'us', gender: 'female' },
  { id: 'af_bella', name: 'Bella', accent: 'us', gender: 'female' },
  { id: 'af_nicole', name: 'Nicole', accent: 'us', gender: 'female' },
  { id: 'af_aoede', name: 'Aoede', accent: 'us', gender: 'female' },
  { id: 'af_kore', name: 'Kore', accent: 'us', gender: 'female' },
  { id: 'af_sarah', name: 'Sarah', accent: 'us', gender: 'female' },
  { id: 'am_michael', name: 'Michael', accent: 'us', gender: 'male' },
  { id: 'am_fenrir', name: 'Fenrir', accent: 'us', gender: 'male' },
  { id: 'am_puck', name: 'Puck', accent: 'us', gender: 'male' },
  { id: 'bf_emma', name: 'Emma', accent: 'gb', gender: 'female' },
  { id: 'bf_isabella', name: 'Isabella', accent: 'gb', gender: 'female' },
  { id: 'bm_george', name: 'George', accent: 'gb', gender: 'male' },
  { id: 'bm_fable', name: 'Fable', accent: 'gb', gender: 'male' },
]

export const KOKORO_DEFAULT_VOICE = 'af_heart'

/** The saved voice if it's a Kokoro voice, otherwise the default one. */
export function kokoroVoiceOrDefault(id: string | undefined): string {
  return KOKORO_VOICES.some((v) => v.id === id) ? id! : KOKORO_DEFAULT_VOICE
}
