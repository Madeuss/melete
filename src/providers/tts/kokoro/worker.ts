/*
 * Runs Kokoro off the main thread: loading the model and generating audio would freeze the UI.
 * The model files come from Hugging Face and are cached by the browser (Cache Storage), so the
 * download happens once. The ONNX runtime is served by the app itself, not a CDN.
 */
import { KokoroTTS, env } from 'kokoro-js'
import ortWasm from 'ort-dist/ort-wasm-simd-threaded.jsep.wasm?url'
import type { KokoroRequest, KokoroResponse } from './protocol'
import { KOKORO_DTYPE, KOKORO_MODEL } from './voices'

// Only the .wasm needs a URL: the bundled runtime already embeds its JS glue (setting `mjs`
// too makes it import that glue's source text as a URL and fail).
env.wasmPaths = { wasm: ortWasm }

const scope = self as unknown as {
  postMessage(message: KokoroResponse, transfer?: Transferable[]): void
  addEventListener(type: 'message', listener: (e: MessageEvent<KokoroRequest>) => void): void
}

const files = new Map<string, { loaded: number; total: number }>()

/** Small files (config, tokenizer) finish before the model's size is known; skip their progress. */
const MODEL_FILE_MIN_BYTES = 5_000_000

function onProgress(info: { status: string; file?: string; loaded?: number; total?: number }) {
  if (info.status !== 'progress' || !info.file || !info.total) return
  files.set(info.file, { loaded: info.loaded ?? 0, total: info.total })
  let loaded = 0
  let total = 0
  for (const f of files.values()) {
    loaded += f.loaded
    total += f.total
  }
  if (total >= MODEL_FILE_MIN_BYTES) scope.postMessage({ type: 'progress', loaded, total })
}

let model: Promise<KokoroTTS> | undefined

function load(): Promise<KokoroTTS> {
  model ??= KokoroTTS.from_pretrained(KOKORO_MODEL, {
    dtype: KOKORO_DTYPE,
    device: 'wasm',
    progress_callback: onProgress,
  }).catch((err: unknown) => {
    model = undefined // let a later request try again
    throw err
  })
  return model
}

// One generation at a time: the model session isn't meant to run calls concurrently.
let queue: Promise<unknown> = Promise.resolve()

const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

scope.addEventListener('message', ({ data }) => {
  if (data.type === 'load') {
    load().then(
      () => scope.postMessage({ type: 'ready' }),
      (err: unknown) => scope.postMessage({ type: 'loadError', message: message(err) }),
    )
    return
  }
  const { id, text, voice, speed } = data
  queue = queue.then(async () => {
    try {
      const tts = await load()
      // The voice ids come from our own list (voices.ts), which matches kokoro-js's.
      const audio = await tts.generate(text, { voice: voice as never, speed })
      const samples = new Float32Array(audio.audio)
      scope.postMessage({ type: 'audio', id, samples, sampleRate: audio.sampling_rate }, [samples.buffer])
    } catch (err) {
      scope.postMessage({ type: 'generateError', id, message: message(err) })
    }
  })
})
