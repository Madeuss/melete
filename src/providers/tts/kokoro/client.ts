import type { KokoroRequest, KokoroResponse } from './protocol'

export type KokoroStatus =
  | { state: 'idle' }
  /** progress is 0–1, or undefined while the file sizes aren't known yet (or it's from cache). */
  | { state: 'loading'; progress?: number }
  | { state: 'ready' }
  | { state: 'error'; message: string }

export interface KokoroAudio {
  samples: Float32Array<ArrayBuffer>
  sampleRate: number
}

export function isKokoroSupported(): boolean {
  return typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined' && typeof AudioContext !== 'undefined'
}

/**
 * Main-thread side of the Kokoro worker. The worker (and the ~90 MB model) is only created
 * when something asks for it, so people who never pick Kokoro never download it.
 */
export class KokoroClient {
  private worker?: Worker
  private status: KokoroStatus = { state: 'idle' }
  private readonly listeners = new Set<() => void>()
  private loading?: { promise: Promise<void>; resolve: () => void; reject: (e: Error) => void }
  private readonly pending = new Map<number, { resolve: (a: KokoroAudio) => void; reject: (e: Error) => void }>()
  private nextId = 1
  private readonly createWorker: () => Worker

  constructor(createWorker: () => Worker) {
    this.createWorker = createWorker
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => void this.listeners.delete(listener)
  }

  getStatus = () => this.status

  /** Downloads (or reads from cache) and initializes the model. Safe to call repeatedly. */
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

  async synthesize(text: string, voice: string, speed: number): Promise<KokoroAudio> {
    await this.load()
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
