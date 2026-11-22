export type ThemePreference = 'system' | 'light' | 'dark'

/**
 * The preference is the source of truth in IndexedDB settings; a copy lives in localStorage
 * only so the first paint already has the right theme (IndexedDB is async). Losing the copy
 * just means one frame in the system theme.
 */
const STORAGE_KEY = 'melete.theme'

let mediaCleanup: (() => void) | undefined

function systemTheme(): 'light' | 'dark' {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(pref: ThemePreference) {
  mediaCleanup?.()
  mediaCleanup = undefined
  const root = document.documentElement
  if (pref === 'system') {
    root.dataset.theme = systemTheme()
    if (typeof matchMedia === 'function') {
      const mq = matchMedia('(prefers-color-scheme: dark)')
      const onChange = () => (root.dataset.theme = systemTheme())
      mq.addEventListener('change', onChange)
      mediaCleanup = () => mq.removeEventListener('change', onChange)
    }
  } else {
    root.dataset.theme = pref
  }
  try {
    localStorage.setItem(STORAGE_KEY, pref)
  } catch {
    // storage blocked: the theme still applies for this visit
  }
}

export function cachedThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    // ignore
  }
  return 'system'
}
