import { describe, expect, it } from 'vitest'
import en from './en.json'
import es from './es.json'
import { detectUiLanguage } from './index'
import ptBR from './pt-BR.json'

function keys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix]
  return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k))
}

function placeholders(obj: unknown, prefix = ''): Record<string, string[]> {
  if (typeof obj === 'string') return { [prefix]: (obj.match(/{{\w+}}/g) ?? []).sort() }
  if (typeof obj !== 'object' || obj === null) return {}
  return Object.assign({}, ...Object.entries(obj).map(([k, v]) => placeholders(v, prefix ? `${prefix}.${k}` : k)))
}

describe('translations', () => {
  const enKeys = keys(en).sort()

  it.each([
    ['pt-BR', ptBR],
    ['es', es],
  ])('%s has exactly the same keys as en', (_name, dict) => {
    expect(keys(dict).sort()).toEqual(enKeys)
  })

  it.each([
    ['pt-BR', ptBR],
    ['es', es],
  ])('%s uses the same {{placeholders}} as en', (_name, dict) => {
    expect(placeholders(dict)).toEqual(placeholders(en))
  })

  it('has no empty strings except where en is empty', () => {
    for (const dict of [en, ptBR, es]) {
      const p = placeholders(dict)
      for (const k of Object.keys(p)) {
        const value = k.split('.').reduce<unknown>((o, part) => (o as Record<string, unknown>)[part], dict)
        const enValue = k.split('.').reduce<unknown>((o, part) => (o as Record<string, unknown>)[part], en)
        if (enValue !== '') expect(value, k).not.toBe('')
      }
    }
  })
})

describe('detectUiLanguage', () => {
  it('maps browser languages', () => {
    expect(detectUiLanguage(['pt-PT'])).toBe('pt-BR')
    expect(detectUiLanguage(['es-MX'])).toBe('es')
    expect(detectUiLanguage(['fr-FR', 'en-GB'])).toBe('en')
    expect(detectUiLanguage(['de'])).toBe('en')
  })
})
