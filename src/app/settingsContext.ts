import { createContext, useContext } from 'react'
import type { Settings } from '../schemas'

export interface SettingsContextValue {
  settings: Settings
  update(patch: Partial<Settings> | ((s: Settings) => Settings)): Promise<Settings>
  reload(): Promise<void>
}

export const SettingsContext = createContext<SettingsContextValue | null>(null)

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>')
  return ctx
}
