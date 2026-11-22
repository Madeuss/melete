/**
 * Microphone level 0..1 for the record button ring. Uses its own getUserMedia stream
 * (the Web Speech API doesn't expose audio). Nothing is recorded or stored.
 */
export class MicLevelMeter {
  private stream?: MediaStream
  private ctx?: AudioContext
  private raf = 0

  async start(onLevel: (level: number) => void): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === 'undefined') return
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.ctx = new AudioContext()
    const source = this.ctx.createMediaStreamSource(this.stream)
    const analyser = this.ctx.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.8
    source.connect(analyser)
    const data = new Uint8Array(analyser.fftSize)
    let smooth = 0

    const tick = () => {
      analyser.getByteTimeDomainData(data)
      let sum = 0
      for (const v of data) {
        const x = (v - 128) / 128
        sum += x * x
      }
      const rms = Math.sqrt(sum / data.length)
      // Speech RMS sits around 0.02–0.2: map to 0..1 with a soft curve, then smooth.
      const level = Math.min(1, Math.sqrt(rms * 6))
      smooth = smooth * 0.7 + level * 0.3
      onLevel(smooth)
      this.raf = requestAnimationFrame(tick)
    }
    tick()
  }

  stop(): void {
    cancelAnimationFrame(this.raf)
    this.stream?.getTracks().forEach((t) => t.stop())
    void this.ctx?.close().catch(() => {})
    this.stream = undefined
    this.ctx = undefined
  }
}
