export interface AudioPlayer {
  /** Plays the samples; resolves when they finish or when stop() is called. */
  play(samples: Float32Array<ArrayBuffer>, sampleRate: number): Promise<void>
  stop(): void
}

/** Plays raw PCM through one shared AudioContext (browsers limit how many can exist). */
export class WebAudioPlayer implements AudioPlayer {
  private context?: AudioContext
  private source?: AudioBufferSourceNode
  private finish?: () => void

  async play(samples: Float32Array<ArrayBuffer>, sampleRate: number): Promise<void> {
    this.stop()
    this.context ??= new AudioContext()
    const context = this.context
    if (context.state === 'suspended') await context.resume()
    const buffer = context.createBuffer(1, samples.length, sampleRate)
    buffer.copyToChannel(samples, 0)
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    return new Promise((resolve) => {
      this.source = source
      this.finish = resolve
      source.onended = () => {
        if (this.source === source) {
          this.source = undefined
          this.finish = undefined
        }
        resolve()
      }
      source.start()
    })
  }

  stop(): void {
    const source = this.source
    const finish = this.finish
    this.source = undefined
    this.finish = undefined
    try {
      source?.stop()
    } catch {
      // already stopped
    }
    finish?.()
  }
}
