import { useSyncExternalStore } from 'react'
import { kokoro } from './services'

/** Kokoro's download/initialization status, for progress and error messages. */
export function useKokoroStatus() {
  return useSyncExternalStore(kokoro.subscribe, kokoro.getStatus)
}
