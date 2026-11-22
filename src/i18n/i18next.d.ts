import 'i18next'
import type en from './en.json'

// Typed keys: t('settings.title') is checked against en.json.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: typeof en }
  }
}
