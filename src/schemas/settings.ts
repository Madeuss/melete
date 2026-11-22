import { z } from 'zod'

export const UiLanguage = z.enum(['pt-BR', 'en', 'es'])
export type UiLanguage = z.infer<typeof UiLanguage>

export const InterviewLanguage = z.enum(['en', 'pt'])
export type InterviewLanguage = z.infer<typeof InterviewLanguage>

export const ThemePreference = z.enum(['system', 'light', 'dark'])

export const LlmSettings = z.object({
  preset: z.string(),
  baseUrl: z.url(),
  apiKey: z.string(),
  model: z.string().min(1),
})
export type LlmSettings = z.infer<typeof LlmSettings>

export const Settings = z.object({
  id: z.literal('default'),
  /** Absent until the user configures a provider; the app opens on Settings in that case. */
  llm: LlmSettings.optional(),
  stt: z.object({ kind: z.enum(['web-speech', 'typed-only']) }),
  tts: z.object({
    kind: z.enum(['browser', 'off']),
    voice: z.string().optional(),
    rate: z.number().min(0.5).max(2).default(1),
  }),
  uiLanguage: UiLanguage,
  interviewLanguage: InterviewLanguage.default('en'),
  theme: ThemePreference.default('system'),
})
export type Settings = z.infer<typeof Settings>

export function defaultSettings(uiLanguage: UiLanguage = 'en'): Settings {
  return {
    id: 'default',
    stt: { kind: 'web-speech' },
    tts: { kind: 'browser', rate: 1 },
    uiLanguage,
    interviewLanguage: 'en',
    theme: 'system',
  }
}
