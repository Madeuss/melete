/** Messages between the main thread and the Kokoro worker. */
import type { KokoroDevice } from './voices'

export type KokoroRequest =
  | { type: 'load'; device: KokoroDevice }
  | { type: 'generate'; id: number; text: string; voice: string; speed: number }

export type KokoroResponse =
  /** Download progress over all model files, in bytes (total grows as files are discovered). */
  | { type: 'progress'; loaded: number; total: number }
  /** device: where it ended up running (WebGPU falls back to wasm if it fails). */
  | { type: 'ready'; device: KokoroDevice }
  | { type: 'loadError'; message: string }
  | { type: 'audio'; id: number; samples: Float32Array<ArrayBuffer>; sampleRate: number }
  | { type: 'generateError'; id: number; message: string }
