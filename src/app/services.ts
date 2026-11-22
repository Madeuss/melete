/*
 * The only place where UI code gets provider instances. Components call these functions
 * (or the engine) instead of constructing providers themselves.
 */
import { InterviewEngine } from '../interview/engine'
import { SPEECH_LANG } from '../interview/samples'
import { createLlmProvider, testConnection } from '../providers/llm/openaiCompatible'
import type { LlmProvider } from '../providers/llm/types'
import { TypedStt } from '../providers/stt/typed'
import type { SpeechToText } from '../providers/stt/types'
import { MicLevelMeter } from '../providers/stt/micLevel'
import { WebSpeechStt, isWebSpeechSupported } from '../providers/stt/webSpeech'
import { BrowserTts, SilentTts, isBrowserTtsSupported } from '../providers/tts/browserTts'
import { isKokoroSupported, kokoro } from '../providers/tts/kokoro/client'
import { WebAudioPlayer } from '../providers/tts/kokoro/player'
import { kokoroVoiceOrDefault } from '../providers/tts/kokoro/voices'
import { KokoroTts } from '../providers/tts/kokoroTts'
import type { TextToSpeech } from '../providers/tts/types'
import type { LlmSettings, Settings } from '../schemas'
import { getRepositories } from '../storage/repositories'

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

export function usesKokoro(settings: Settings): boolean {
  return settings.tts.kind === 'kokoro' && isKokoroSupported()
}

const audioPlayer = new WebAudioPlayer()

export function ttsFromSettings(settings: Settings): TextToSpeech {
  if (settings.tts.kind === 'off') return new SilentTts()
  const browser = isBrowserTtsSupported()
    ? new BrowserTts({
        lang: SPEECH_LANG[settings.interviewLanguage],
        // With Kokoro, the saved voice is a Kokoro id; the browser fallback uses its default voice.
        voiceName: settings.tts.kind === 'browser' ? settings.tts.voice : undefined,
        rate: settings.tts.rate,
      })
    : new SilentTts()
  if (!usesKokoro(settings)) return browser
  const voice = kokoroVoiceOrDefault(settings.tts.voice, settings.interviewLanguage)
  return new KokoroTts({
    synthesize: (sentence) => kokoro.synthesize(sentence, voice, settings.tts.rate),
    player: audioPlayer,
    fallback: browser,
  })
}

/** Starts loading the Kokoro model ahead of time if it's in use and already downloaded. */
export function preloadVoice(settings: Settings): void {
  if (usesKokoro(settings)) kokoro.loadIfDownloaded().catch(() => {}) // the status shows why
}

export { kokoro, isKokoroSupported }

export function createMicLevelMeter(): MicLevelMeter {
  return new MicLevelMeter()
}

/** Builds the interview engine with the providers chosen in settings. */
export function createEngine(settings: Settings): InterviewEngine {
  if (!settings.llm) throw new Error('No provider configured')
  const repos = getRepositories()
  return new InterviewEngine({
    llm: createLlmProvider(settings.llm),
    stt: sttFromSettings(settings),
    tts: ttsFromSettings(settings),
    repos: { sessions: repos.sessions, turns: repos.turns, stories: repos.stories },
    feedbackLanguage: settings.uiLanguage,
  })
}
