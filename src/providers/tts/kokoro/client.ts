import type { KokoroRequest, KokoroResponse } from './protocol'
import { KOKORO_MODEL } from './voices'

export type KokoroStatus =
  /** Not checked yet. */
  | { state: 'idle' }
  /** Not in this browser: only downloaded when the user asks (it's ~110 MB). */
  | { state: 'notDownloaded' }
  /** progress is 0–1, or undefined while the file sizes aren't known yet (or it's from cache). */
  | { state: 'loading'; progress?: number }
  | { state: 'ready' }
  | { state: 'error'; message: string }

export interface KokoroAudio {
  samples: Float32Array<ArrayBuffer>
  sampleRate: number
}

/** Whether the model weights are already in transformers.js's cache (so loading downloads nothing). */
export async function isKokoroCached(): Promise<boolean> {
  try {
    const cache = await caches.open('transformers-cache')
    const keys = await cache.keys()
    return keys.some((r) => r.url.includes(KOKORO_MODEL) && r.url.endsWith('.onnx'))
  } catch {
    return false // no Cache Storage (private mode, old browser)
  }
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
  private readonly isCached: () => Promise<boolean>

  constructor(createWorker: () => Worker, isCached: () => Promise<boolean> = isKokoroCached) {
    this.createWorker = createWorker
    this.isCached = isCached
  }

  /** Loads the model if it's already downloaded; otherwise just records that it isn't. Never downloads. */
  async loadIfDownloaded(): Promise<void> {
    if (this.status.state === 'ready' || this.status.state === 'loading') return this.load()
    if (await this.isCached()) return this.load()
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
    this.post({ type: 'load' })
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
