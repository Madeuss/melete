import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { detectUiLanguage, setUiLanguage } from '../i18n'
import type { Settings } from '../schemas'
import { getRepositories } from '../storage/repositories'
import { applyTheme } from '../styles/theme'
import { SettingsContext, type SettingsContextValue } from './settingsContext'

/**
 * Holds the latest saved settings and serializes writes, so quick successive updates
 * build on each other instead of each starting from the value captured at render time.
 */
class SettingsStore {
  private latest?: Settings
  private queue: Promise<unknown> = Promise.resolve()
  private readonly publish: (s: Settings) => void

  constructor(publish: (s: Settings) => void) {
    this.publish = publish
  }

  async load(): Promise<void> {
    this.set(await getRepositories().settings.getOrDefault(detectUiLanguage()))
  }

  private set(s: Settings) {
    this.latest = s
    this.publish(s)
  }

  update: SettingsContextValue['update'] = (patch) => {
    const run = this.queue.then(async () => {
      const current = this.latest!
      const next = typeof patch === 'function' ? patch(current) : { ...current, ...patch }
      const saved = await getRepositories().settings.save(next)
      this.set(saved)
      return saved
    })
    this.queue = run.catch(() => {})
    return run
  }

  reload = () => this.load()
}

/** Loads settings once, keeps them in memory and applies language and theme. */
export function SettingsProvider({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const [settings, setSettings] = useState<Settings>()
  const [store] = useState(() => new SettingsStore(setSettings))

  useEffect(() => {
    void store.load()
  }, [store])

  useEffect(() => {
    if (!settings) return
    setUiLanguage(settings.uiLanguage)
    applyTheme(settings.theme)
  }, [settings])

  const value = useMemo(
    () => (settings ? { settings, update: store.update, reload: store.reload } : undefined),
    [settings, store],
  )

  if (!value) return fallback ?? null
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}
