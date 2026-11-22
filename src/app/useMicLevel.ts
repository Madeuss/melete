import { useEffect, useState } from 'react'
import { createMicLevelMeter } from './services'

/** Keeps a mic level (0..1) while recording, for the ring around the record button. */
export function useMicLevel(active: boolean) {
  const [level, setLevel] = useState(0)
  useEffect(() => {
    if (!active) return
    const meter = createMicLevelMeter()
    meter.start(setLevel).catch(() => {}) // the meter is decoration; recognition has its own errors
    return () => {
      meter.stop()
      setLevel(0)
    }
  }, [active])
  return active ? level : 0
}
