import { describe, expect, it } from 'vitest'
import { FakeTts } from '../fakes/FakeTts'
import { KokoroClient, type KokoroAudio } from './kokoro/client'
import type { AudioPlayer } from './kokoro/player'
import type { KokoroRequest, KokoroResponse } from './kokoro/protocol'
import { kokoroVoiceOrDefault, type KokoroDevice } from './kokoro/voices'
import { KokoroTts } from './kokoroTts'

const audioFor = (text: string): KokoroAudio => ({ samples: new Float32Array([text.length]), sampleRate: 24000 })

/** Records the order of synthesize/play calls; plays finish when the test says so. */
function setup(opts: { failOn?: string } = {}) {
  const log: string[] = []
  const plays: Array<() => void> = []
  const player: AudioPlayer & { stops: number } = {
    stops: 0,
    play(samples) {
      log.push(`play ${samples[0]}`)
      return new Promise((resolve) => plays.push(resolve))
    },
    stop() {
      this.stops++
      plays.splice(0).forEach((finish) => finish())
    },
  }
  const fallback = new FakeTts()
  const tts = new KokoroTts({
    synthesize: (sentence) => {
      log.push(`synth ${sentence}`)
      return sentence === opts.failOn ? Promise.reject(new Error('boom')) : Promise.resolve(audioFor(sentence))
    },
    player,
    fallback,
  })
  const finishPlay = async () => {
    await flush()
    plays.shift()?.()
    await flush()
  }
  return { tts, log, player, fallback, finishPlay }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('KokoroTts', () => {
  it('plays sentences in order, generating the next one while the current one plays', async () => {
    const { tts, log, finishPlay } = setup()
    const done = tts.speak('Hi there. How are you?')
    await finishPlay()
    await finishPlay()
    await done
    expect(log).toEqual(['synth Hi there.', 'synth How are you?', 'play 9', 'play 12'])
  })

  it('stops playing and generating when cancelled', async () => {
    const { tts, log, player, finishPlay } = setup()
    const done = tts.speak('One. Two. Three.')
    await flush()
    tts.cancel()
    await done
    await finishPlay()
    expect(player.stops).toBeGreaterThan(0)
    expect(log.filter((l) => l.startsWith('play'))).toEqual(['play 4'])
    expect(log).not.toContain('synth Three.')
  })

  it('a newer reading stops the older one', async () => {
    const { tts, log, finishPlay } = setup()
    const first = tts.speak('First one. Still first.')
    await flush()
    const second = tts.speak('Second.')
    await first
    await finishPlay()
    await second
    expect(log.filter((l) => l.startsWith('play'))).toEqual(['play 10', 'play 7'])
  })

  it('uses audio generated ahead of time by prepare(), once', async () => {
    const { tts, log, finishPlay } = setup()
    tts.prepare('Next question?')
    expect(log).toEqual(['synth Next question?'])

    const done = tts.speak('Next question?')
    await finishPlay()
    await done
    expect(log).toEqual(['synth Next question?', 'play 14'])

    const again = tts.speak('Next question?')
    await finishPlay()
    await again
    expect(log.filter((l) => l.startsWith('synth'))).toHaveLength(2)
  })

  it('reads the rest with the fallback voice when Kokoro fails', async () => {
    const { tts, fallback, finishPlay } = setup({ failOn: 'Two.' })
    const done = tts.speak('One. Two. Three.')
    await finishPlay()
    await done
    expect(fallback.spoken).toEqual(['Two. Three.'])
  })
})

/** A worker double that answers like the real one. */
class FakeWorker extends EventTarget {
  readonly requests: KokoroRequest[] = []
  failLoad = false
  /** Pretend WebGPU failed and the worker fell back to wasm. */
  fallBackToWasm = false
  postMessage(request: KokoroRequest) {
    this.requests.push(request)
    queueMicrotask(() => {
      if (request.type === 'load') {
        if (this.failLoad) return this.reply({ type: 'loadError', message: 'offline' })
        this.reply({ type: 'progress', loaded: 50, total: 100 })
        this.reply({ type: 'ready', device: this.fallBackToWasm ? 'wasm' : request.device })
      } else {
        this.reply({ type: 'audio', id: request.id, samples: new Float32Array(3), sampleRate: 24000 })
      }
    })
  }
  reply(data: KokoroResponse) {
    this.dispatchEvent(new MessageEvent('message', { data }))
  }
}

/** Test environment: which device is detected and whether its weights are cached. */
function env(opts: { device?: KokoroDevice; cached?: boolean; onReady?: (r: KokoroDevice, a: KokoroDevice) => void } = {}) {
  return {
    detectDevice: () => Promise.resolve(opts.device ?? 'wasm'),
    isCached: () => Promise.resolve(opts.cached ?? false),
    onReady: opts.onReady,
  }
}

describe('KokoroClient', () => {
  it('creates the worker lazily, loads once and synthesizes', async () => {
    const worker = new FakeWorker()
    let created = 0
    const client = new KokoroClient(
      () => {
        created++
        return worker as unknown as Worker
      },
      env({ cached: true }), // already downloaded
    )
    const states: string[] = []
    client.subscribe(() => states.push(client.getStatus().state))
    expect(created).toBe(0)

    const audio = await client.synthesize('Hello.', 'af_heart', 1)
    await client.load()
    expect(audio.samples).toHaveLength(3)
    expect(created).toBe(1)
    expect(worker.requests.filter((r) => r.type === 'load')).toHaveLength(1)
    expect(states).toEqual(['loading', 'loading', 'ready'])
  })

  it('never downloads on its own: without the model, synthesizing fails so the browser voice reads', async () => {
    let created = 0
    const client = new KokoroClient(
      () => {
        created++
        return new FakeWorker() as unknown as Worker
      },
      env({ cached: false }),
    )
    await expect(client.synthesize('Hello.', 'af_heart', 1)).rejects.toThrow('not downloaded')
    expect(client.getStatus()).toEqual({ state: 'notDownloaded' })
    expect(created).toBe(0)

    await client.load() // the user pressed "Download"
    expect(client.getStatus().state).toBe('ready')
    await expect(client.synthesize('Hello.', 'af_heart', 1)).resolves.toMatchObject({ sampleRate: 24000 })
  })

  it('asks the worker for the detected device and reports a fallback to wasm', async () => {
    const worker = new FakeWorker()
    worker.fallBackToWasm = true
    const ready: string[] = []
    const client = new KokoroClient(
      () => worker as unknown as Worker,
      env({ device: 'webgpu', onReady: (requested, actual) => ready.push(`${requested}->${actual}`) }),
    )
    expect(await client.device()).toBe('webgpu')
    await client.load()
    expect(worker.requests[0]).toEqual({ type: 'load', device: 'webgpu' })
    expect(ready).toEqual(['webgpu->wasm'])
  })

  it('reports a failed download and lets the user try again', async () => {
    const worker = new FakeWorker()
    worker.failLoad = true
    const client = new KokoroClient(() => worker as unknown as Worker, env())
    await expect(client.load()).rejects.toThrow('offline')
    expect(client.getStatus()).toEqual({ state: 'error', message: 'offline' })

    worker.failLoad = false
    await client.load()
    expect(client.getStatus().state).toBe('ready')
  })
})

it('picks a Kokoro voice for the interview language, falling back to its default', () => {
  expect(kokoroVoiceOrDefault('bm_george', 'en')).toBe('bm_george')
  expect(kokoroVoiceOrDefault('Microsoft Zira - English (United States)', 'en')).toBe('af_heart')
  expect(kokoroVoiceOrDefault(undefined, 'en')).toBe('af_heart')
  expect(kokoroVoiceOrDefault('pm_alex', 'pt')).toBe('pm_alex')
  // An English voice can't read a Portuguese interview.
  expect(kokoroVoiceOrDefault('af_heart', 'pt')).toBe('pf_dora')
})
