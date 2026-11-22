import type { TFunction } from 'i18next'
import { LlmError } from '../providers/llm/errors'
import { getPreset } from '../providers/llm/presets'
import { SttError } from '../providers/stt/types'

export interface ErrorMessage {
  title: string
  action: string
  detail?: string
}

/** Turns a provider error into a title + suggested action for the user. Never includes the key. */
export function llmErrorMessage(t: TFunction, err: unknown, presetId?: string): ErrorMessage {
  if (!(err instanceof LlmError)) {
    return { title: t('errors.llm.unknown.title'), action: t('errors.llm.unknown.action') }
  }
  const preset = getPreset(presetId ?? 'custom')
  const origin = window.location.origin
  const hint =
    preset.id === 'ollama'
      ? t('errors.localHint.ollama', { origin })
      : preset.id === 'lmstudio'
        ? t('errors.localHint.lmstudio')
        : t('errors.localHint.other', { origin })
  return {
    title: t(`errors.llm.${err.kind}.title`, { name: preset.name }),
    action: t(`errors.llm.${err.kind}.action`, { name: preset.name, hint }),
    detail: err.detail ? t('common.providerMessage', { detail: err.detail }) : undefined,
  }
}

export function sttErrorMessage(t: TFunction, err: unknown): string {
  const kind = err instanceof SttError ? err.kind : 'unknown'
  return t(`errors.stt.${kind}`)
}
