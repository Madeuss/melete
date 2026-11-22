import type { InterviewLanguage } from '../schemas'

/** Sample question spoken by "Hear a sample" in settings, in the interview language. */
export const SAMPLE_QUESTION: Record<InterviewLanguage, string> = {
  en: 'Tell me about a time you disagreed with a teammate. What did you do?',
  pt: 'Me conte sobre uma vez em que você discordou de alguém do time. O que você fez?',
}

/** BCP 47 tag for speech APIs. */
export const SPEECH_LANG: Record<InterviewLanguage, string> = {
  en: 'en-US',
  pt: 'pt-BR',
}
