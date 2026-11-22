import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { detectUiLanguage, setUiLanguage } from '../i18n'
import type { Settings } from '../schemas'
import { getRepositories } from '../storage/repositories'
import { applyTheme } from '../styles/theme'
import { SettingsContext, type SettingsContextValue } from './settingsContext'

/** Loads settings once, keeps them in memory and applies language and theme. */
export function SettingsProvider({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const [settings, setSettings] = useState<Settings>()
  // Latest value + a queue, so quick successive updates build on each other instead of
  // each starting from the value captured at render time.
  const latest = useRef<Settings | undefined>(undefined)
  const queue = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    let alive = true
    getRepositories()
      .settings.getOrDefault(detectUiLanguage())
      .then((s) => {
        if (!alive) return
        latest.current = s
        setSettings(s)
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!settings) return
    setUiLanguage(settings.uiLanguage)
    applyTheme(settings.theme)
  }, [settings])

  const update = useCallback<SettingsContextValue['update']>((patch) => {
    const run = queue.current.then(async () => {
      const current = latest.current!
      const next = typeof patch === 'function' ? patch(current) : { ...current, ...patch }
      const saved = await getRepositories().settings.save(next)
      latest.current = saved
      setSettings(saved)
      return saved
    })
    queue.current = run.catch(() => {})
    return run
  }, [])

  const reload = useCallback(async () => {
    const s = await getRepositories().settings.getOrDefault(detectUiLanguage())
    latest.current = s
    setSettings(s)
  }, [])

  const value = useMemo(() => (settings ? { settings, update, reload } : undefined), [settings, update, reload])

  if (!value) return fallback ?? null
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}
