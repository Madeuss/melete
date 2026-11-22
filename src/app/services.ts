/*
 * The only place where UI code gets provider instances. Components call these functions
 * (or the engine) instead of constructing providers themselves.
 */
import { SPEECH_LANG } from '../interview/samples'
import { createLlmProvider, testConnection } from '../providers/llm/openaiCompatible'
import type { LlmProvider } from '../providers/llm/types'
import { TypedStt } from '../providers/stt/typed'
import type { SpeechToText } from '../providers/stt/types'
import { WebSpeechStt, isWebSpeechSupported } from '../providers/stt/webSpeech'
import { BrowserTts, SilentTts, isBrowserTtsSupported } from '../providers/tts/browserTts'
import type { TextToSpeech } from '../providers/tts/types'
import type { LlmSettings, Settings } from '../schemas'

export function llmFromSettings(llm: LlmSettings): LlmProvider {
  return createLlmProvider(llm)
}

export function checkConnection(llm: LlmSettings, signal?: AbortSignal): Promise<void> {
  return testConnection(createLlmProvider(llm), signal)
}

export function fetchModels(llm: LlmSettings, signal?: AbortSignal): Promise<string[]> {
  return createLlmProvider(llm).listModels(signal)
}

/** Whether answers can be spoken with the current settings and browser. */
export function canUseVoice(settings: Settings): boolean {
  return settings.stt.kind === 'web-speech' && isWebSpeechSupported()
}

export function sttFromSettings(settings: Settings): SpeechToText {
  return canUseVoice(settings) ? new WebSpeechStt(SPEECH_LANG[settings.interviewLanguage]) : new TypedStt()
}

export function ttsFromSettings(settings: Settings): TextToSpeech {
  if (settings.tts.kind === 'off' || !isBrowserTtsSupported()) return new SilentTts()
  return new BrowserTts({
    lang: SPEECH_LANG[settings.interviewLanguage],
    voiceName: settings.tts.voice,
    rate: settings.tts.rate,
  })
}
