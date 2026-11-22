import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { UiLanguage } from '../schemas'
import en from './en.json'
import es from './es.json'
import ptBR from './pt-BR.json'

export const resources = {
  en: { translation: en },
  'pt-BR': { translation: ptBR },
  es: { translation: es },
} as const

/** Language names in their own language (not translated). */
export const LANGUAGE_NAMES: Record<UiLanguage, string> = {
  'pt-BR': 'Português (Brasil)',
  en: 'English',
  es: 'Español',
}

/** First visit: follow the browser, falling back to English. */
export function detectUiLanguage(langs: readonly string[] = navigator.languages ?? [navigator.language]): UiLanguage {
  for (const l of langs) {
    const lower = l.toLowerCase()
    if (lower.startsWith('pt')) return 'pt-BR'
    if (lower.startsWith('es')) return 'es'
    if (lower.startsWith('en')) return 'en'
  }
  return 'en'
}

void i18n.use(initReactI18next).init({
  resources,
  lng: detectUiLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
})

export function setUiLanguage(lang: UiLanguage) {
  if (i18n.language !== lang) void i18n.changeLanguage(lang)
  document.documentElement.lang = lang
}

export default i18n
