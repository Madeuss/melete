import { useEffect, useState, type ReactNode } from 'react'
import { detectUiLanguage, setUiLanguage } from '../i18n'
import type { Settings } from '../schemas'
import { getRepositories } from '../storage/repositories'
import { applyTheme } from '../styles/theme'
import { SettingsContext } from './settingsContext'

/** Loads settings once, keeps them in memory and applies language and theme. */
export function SettingsProvider({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const [settings, setSettings] = useState<Settings>()

  useEffect(() => {
    let alive = true
    getRepositories()
      .settings.getOrDefault(detectUiLanguage())
      .then((s) => alive && setSettings(s))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!settings) return
    setUiLanguage(settings.uiLanguage)
    applyTheme(settings.theme)
  }, [settings])

  if (!settings) return fallback ?? null

  async function update(patch: Partial<Settings> | ((s: Settings) => Settings)) {
    const current = settings!
    const next = typeof patch === 'function' ? patch(current) : { ...current, ...patch }
    const saved = await getRepositories().settings.save(next)
    setSettings(saved)
    return saved
  }

  async function reload() {
    setSettings(await getRepositories().settings.getOrDefault(detectUiLanguage()))
  }

  return <SettingsContext.Provider value={{ settings, update, reload }}>{children}</SettingsContext.Provider>
}
