/*
 * Runs Kokoro off the main thread: loading the model and generating audio would freeze the UI.
 * The model files come from Hugging Face and are cached by the browser (Cache Storage), so the
 * download happens once. The ONNX runtime is served by the app itself, not a CDN.
 */
import { KokoroTTS, env } from 'kokoro-js'
import ortWasm from 'ort-dist/ort-wasm-simd-threaded.jsep.wasm?url'
import { fromEspeakIpa } from './phonemes'
import type { KokoroRequest, KokoroResponse } from './protocol'
import { KOKORO_MODEL, KOKORO_VARIANTS, isPortugueseVoice, type KokoroDevice } from './voices'
import type { EspeakNgWorker } from '@echogarden/espeak-ng-emscripten'

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

let model: Promise<{ tts: KokoroTTS; device: KokoroDevice }> | undefined

async function loadOn(device: KokoroDevice): Promise<KokoroTTS> {
  const { dtype } = KOKORO_VARIANTS[device]
  const tts = await KokoroTTS.from_pretrained(KOKORO_MODEL, { dtype, device, progress_callback: onProgress })
  if (device === 'webgpu') {
    // The first generation compiles the GPU shaders (~2–4 s): do it now, not on the first question.
    // It also catches GPUs that produce garbage (NaN), which happens with some weights/drivers.
    const warmup = await tts.generate('Hello.', { voice: 'af_heart' })
    if (warmup.audio.some(Number.isNaN)) throw new Error('WebGPU produced invalid audio')
  }
  return tts
}

/** Loads on the requested device; if WebGPU fails, falls back to wasm (a smaller, slower model). */
function load(device: KokoroDevice = 'wasm'): Promise<{ tts: KokoroTTS; device: KokoroDevice }> {
  model ??= (async () => {
    if (device === 'webgpu') {
      try {
        return { tts: await loadOn('webgpu'), device: 'webgpu' as const }
      } catch {
        files.clear() // the progress bar restarts for the wasm files
      }
    }
    return { tts: await loadOn('wasm'), device: 'wasm' as const }
  })().catch((err: unknown) => {
    model = undefined // let a later request try again
    throw err
  })
  return model
}

/*
 * Portuguese needs espeak-ng with its Portuguese data: the phonemizer bundled with kokoro-js only
 * ships English. Echogarden's Emscripten build is loaded the first time a Portuguese voice speaks;
 * it fetches its ~25 MB language data (espeak-ng.data) from next to its own script, which the app
 * serves (see vite.config.ts).
 */
let espeak: Promise<EspeakNgWorker> | undefined

function getEspeak(): Promise<EspeakNgWorker> {
  espeak ??= (async () => {
    const { default: initEspeak } = await import('@echogarden/espeak-ng-emscripten')
    const module = await initEspeak()
    const worker = new module.eSpeakNGWorker()
    worker.set_voice('pt-br')
    return worker
  })().catch((err: unknown) => {
    espeak = undefined
    throw err
  })
  return espeak
}

async function phonemize(text: string): Promise<string> {
  const { code, ipa } = (await getEspeak()).synthesize_ipa(text)
  if (code !== 0) throw new Error(`espeak-ng failed (${code})`)
  return fromEspeakIpa(ipa)
}

/** Punctuation is kept as is (it shapes the prosody); only the words between it are phonemized. */
const PUNCTUATION = /(\s*[;:,.!?¡¿—…"«»“”(){}[\]]+\s*)+/g

/**
 * Text → phonemes for Brazilian Portuguese, as Kokoro's Python pipeline does for non-English
 * languages: espeak-ng ('pt-br') phonemes, keeping the punctuation.
 */
async function portuguesePhonemes(text: string): Promise<string> {
  const parts: string[] = []
  let last = 0
  for (const m of text.matchAll(PUNCTUATION)) {
    if (m.index > last) parts.push(await phonemize(text.slice(last, m.index)))
    parts.push(m[0])
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(await phonemize(text.slice(last)))
  return parts.join('').trim()
}

async function generate(tts: KokoroTTS, text: string, voice: string, speed: number) {
  // The voice ids come from our own list (voices.ts), which matches the model's voice files.
  if (!isPortugueseVoice(voice)) return tts.generate(text, { voice: voice as never, speed })
  const { input_ids } = tts.tokenizer(await portuguesePhonemes(text), { truncation: true })
  return tts.generate_from_ids(input_ids, { voice: voice as never, speed })
}

// One generation at a time: the model session isn't meant to run calls concurrently.
let queue: Promise<unknown> = Promise.resolve()

const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

scope.addEventListener('message', ({ data }) => {
  if (data.type === 'load') {
    load(data.device).then(
      ({ device }) => scope.postMessage({ type: 'ready', device }),
      (err: unknown) => scope.postMessage({ type: 'loadError', message: message(err) }),
    )
    return
  }
  const { id, text, voice, speed } = data
  queue = queue.then(async () => {
    try {
      const { tts } = await load()
      const audio = await generate(tts, text, voice, speed)
      const samples = new Float32Array(audio.audio)
      scope.postMessage({ type: 'audio', id, samples, sampleRate: audio.sampling_rate }, [samples.buffer])
    } catch (err) {
      scope.postMessage({ type: 'generateError', id, message: message(err) })
    }
  })
})
