import type { KokoroRequest, KokoroResponse } from './protocol'
import { KOKORO_MODEL, KOKORO_VARIANTS, type KokoroDevice } from './voices'

export type KokoroStatus =
  /** Not checked yet. */
  | { state: 'idle' }
  /** Not in this browser: only downloaded when the user asks (110–350 MB). */
  | { state: 'notDownloaded' }
  /** progress is 0–1, or undefined while the file sizes aren't known yet (or it's from cache). */
  | { state: 'loading'; progress?: number }
  | { state: 'ready' }
  | { state: 'error'; message: string }

export interface KokoroAudio {
  samples: Float32Array<ArrayBuffer>
  sampleRate: number
}

const CACHE_NAME = 'transformers-cache' // where transformers.js keeps downloaded files
const FALLBACK_KEY = 'melete.kokoroDevice' // set to 'wasm' when WebGPU failed on this browser

const modelFileUrl = (device: KokoroDevice) => `${KOKORO_MODEL}/resolve/main/${KOKORO_VARIANTS[device].file}`

/** Whether this device's weights are already in transformers.js's cache (so loading downloads nothing). */
export async function isKokoroCached(device: KokoroDevice): Promise<boolean> {
  try {
    const keys = await (await caches.open(CACHE_NAME)).keys()
    return keys.some((r) => r.url.endsWith(modelFileUrl(device)))
  } catch {
    return false // no Cache Storage (private mode, old browser)
  }
}

/** Removes the other device's weights (e.g. the wasm model after switching to WebGPU). Best effort. */
async function removeOtherWeights(device: KokoroDevice) {
  try {
    const cache = await caches.open(CACHE_NAME)
    const other = modelFileUrl(device === 'webgpu' ? 'wasm' : 'webgpu')
    for (const r of await cache.keys()) if (r.url.endsWith(other)) await cache.delete(r)
  } catch {
    // nothing to clean, or no Cache Storage
  }
}

/** WebGPU when the browser has a usable adapter (and it didn't fail here before), otherwise wasm. */
export async function detectKokoroDevice(): Promise<KokoroDevice> {
  try {
    if (localStorage.getItem(FALLBACK_KEY) === 'wasm') return 'wasm'
  } catch {
    // no storage: just detect
  }
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu
    return gpu && (await gpu.requestAdapter()) ? 'webgpu' : 'wasm'
  } catch {
    return 'wasm'
  }
}

function rememberFallback(requested: KokoroDevice, actual: KokoroDevice) {
  if (requested === actual) return
  try {
    localStorage.setItem(FALLBACK_KEY, actual)
  } catch {
    // it will just try WebGPU again next time
  }
}

interface KokoroEnv {
  detectDevice: () => Promise<KokoroDevice>
  isCached: (device: KokoroDevice) => Promise<boolean>
  /** Runs once the model is ready on `actual` (cleanup, remembering a fallback). */
  onReady?: (requested: KokoroDevice, actual: KokoroDevice) => void
}

const browserEnv: KokoroEnv = {
  detectDevice: detectKokoroDevice,
  isCached: isKokoroCached,
  onReady: (requested, actual) => {
    rememberFallback(requested, actual)
    void removeOtherWeights(actual)
  },
}

export function isKokoroSupported(): boolean {
  return typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined' && typeof AudioContext !== 'undefined'
}

/**
 * Main-thread side of the Kokoro worker. The model is only downloaded by load(), which the UI
 * calls when the user asks for it; everything else only uses Kokoro if it's already cached.
 */
export class KokoroClient {
  private worker?: Worker
  private status: KokoroStatus = { state: 'idle' }
  private readonly listeners = new Set<() => void>()
  private loading?: { promise: Promise<void>; resolve: () => void; reject: (e: Error) => void }
  private readonly pending = new Map<number, { resolve: (a: KokoroAudio) => void; reject: (e: Error) => void }>()
  private nextId = 1
  private readonly createWorker: () => Worker
  private readonly env: KokoroEnv
  private devicePromise?: Promise<KokoroDevice>
  private requestedDevice: KokoroDevice = 'wasm'

  constructor(createWorker: () => Worker, env: KokoroEnv = browserEnv) {
    this.createWorker = createWorker
    this.env = env
  }

  /** Where the model will run here, and so how big the download is. */
  device(): Promise<KokoroDevice> {
    this.devicePromise ??= this.env.detectDevice()
    return this.devicePromise
  }

  /** Loads the model if it's already downloaded; otherwise just records that it isn't. Never downloads. */
  async loadIfDownloaded(): Promise<void> {
    if (this.status.state === 'ready' || this.status.state === 'loading') return this.load()
    if (await this.env.isCached(await this.device())) return this.load()
    if (this.status.state === 'idle') this.setStatus({ state: 'notDownloaded' })
    throw new Error('Kokoro is not downloaded')
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => void this.listeners.delete(listener)
  }

  getStatus = () => this.status

  /** Downloads (or reads from cache) and initializes the model. Safe to call repeatedly. Only on user request. */
  load(): Promise<void> {
    if (this.status.state === 'ready') return Promise.resolve()
    if (this.loading) return this.loading.promise
    let resolve!: () => void
    let reject!: (e: Error) => void
    const promise = new Promise<void>((res, rej) => {
      resolve = res
      reject = rej
    })
    this.loading = { promise, resolve, reject }
    this.setStatus({ state: 'loading' })
    void this.device().then((device) => {
      this.requestedDevice = device
      this.post({ type: 'load', device })
    })
    return promise
  }

  /** Fails (and the caller falls back to the browser voice) when the model was never downloaded. */
  async synthesize(text: string, voice: string, speed: number): Promise<KokoroAudio> {
    await this.loadIfDownloaded()
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.post({ type: 'generate', id, text, voice, speed })
    })
  }

  private post(request: KokoroRequest) {
    if (!this.worker) {
      this.worker = this.createWorker()
      this.worker.addEventListener('message', (e: MessageEvent<KokoroResponse>) => this.onMessage(e.data))
      // The worker script itself failed (blocked, unsupported): nothing will ever answer.
      this.worker.addEventListener('error', (e) => {
        e.preventDefault()
        this.worker = undefined
        this.failAll(e.message || 'Kokoro worker failed')
      })
    }
    this.worker.postMessage(request)
  }

  private onMessage(msg: KokoroResponse) {
    switch (msg.type) {
      case 'progress':
        if (this.status.state === 'loading') {
          this.setStatus({ state: 'loading', progress: msg.total > 0 ? msg.loaded / msg.total : undefined })
        }
        return
      case 'ready':
        this.env.onReady?.(this.requestedDevice, msg.device)
        this.setStatus({ state: 'ready' })
        this.loading?.resolve()
        this.loading = undefined
        return
      case 'loadError':
        this.failLoad(msg.message)
        return
      case 'audio':
        this.pending.get(msg.id)?.resolve({ samples: msg.samples, sampleRate: msg.sampleRate })
        this.pending.delete(msg.id)
        return
      case 'generateError':
        this.pending.get(msg.id)?.reject(new Error(msg.message))
        this.pending.delete(msg.id)
        return
    }
  }

  private failLoad(message: string) {
    this.setStatus({ state: 'error', message })
    this.loading?.reject(new Error(message))
    this.loading = undefined
  }

  private failAll(message: string) {
    this.failLoad(message)
    for (const p of this.pending.values()) p.reject(new Error(message))
    this.pending.clear()
  }

  private setStatus(status: KokoroStatus) {
    this.status = status
    for (const l of this.listeners) l()
  }
}

/** The app-wide instance: one worker, one model in memory. */
export const kokoro = new KokoroClient(
  () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'kokoro' }),
)
