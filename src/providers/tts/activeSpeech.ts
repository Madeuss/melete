/*
 * Only one thing reads aloud at a time, whatever engine it uses. Starting a reading stops the
 * previous one right away (its stop function runs) and makes its loop bail out at the next check.
 */
let current = 0
let stopCurrent: (() => void) | undefined

/** Starts a reading; `stop` silences it immediately. Returns the id the reading checks against. */
export function beginSpeech(stop: () => void): number {
  const previous = stopCurrent
  current++
  stopCurrent = stop
  previous?.()
  return current
}

export function isCurrentSpeech(id: number): boolean {
  return id === current
}

/** Stops the reading with this id, if it's still the current one. */
export function endSpeech(id: number): void {
  if (id !== current) return
  current++
  const stop = stopCurrent
  stopCurrent = undefined
  stop?.()
}
