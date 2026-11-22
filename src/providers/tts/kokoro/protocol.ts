/** Messages between the main thread and the Kokoro worker. */

export type KokoroRequest =
  | { type: 'load' }
  | { type: 'generate'; id: number; text: string; voice: string; speed: number }

export type KokoroResponse =
  /** Download progress over all model files, in bytes (total grows as files are discovered). */
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'ready' }
  | { type: 'loadError'; message: string }
  | { type: 'audio'; id: number; samples: Float32Array<ArrayBuffer>; sampleRate: number }
  | { type: 'generateError'; id: number; message: string }
