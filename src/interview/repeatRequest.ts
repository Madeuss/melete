/*
 * "Could you repeat the question?" said out loud, instead of an answer. Common phrasings are
 * caught here without a model call; other short replies are left to the classifyReply prompt.
 */
import type { InterviewLanguage } from '../schemas'
import { countWords } from './metrics'

/** Replies longer than this are always treated as answers. */
export const MAX_REPEAT_REQUEST_WORDS = 20

// Only phrasings that ask for the question; "I had to repeat the deploy" must stay an answer.
const PATTERNS = [
  // English
  /\b(can|could|would) you (please )?(repeat|rephrase|say (that|it|the question) again)\b/i,
  /\b(please repeat|repeat (the question|that|it|please))\b/i,
  /\bsay (that|it|the question) again\b/i,
  /\bcome again\b/i,
  /^\W*(sorry|pardon( me)?)\W*$/i,
  /\bi did(n'?t| not) (get|catch|hear|understand) (that|it|the question|you)\b/i,
  // Portuguese
  /\b(pode|poderia|consegue) (repetir|reformular|falar de novo)\b/i,
  /\brepete (a pergunta|por favor)\b/i,
  /\bn[ãa]o (entendi|ouvi) (a pergunta|direito|bem)\b/i,
  // Spanish
  /\b(puede|podr[ií]a|puedes) (repetir|repetirla|reformular)\b/i,
  /\bno (entend[ií]|o[ií]) (la pregunta|bien)\b/i,
]

export function looksLikeRepeatRequest(text: string): boolean {
  return countWords(text) <= MAX_REPEAT_REQUEST_WORDS && PATTERNS.some((p) => p.test(text))
}

/** What the interviewer says before repeating the question, in the interview language. */
export const REPEAT_LEAD_IN: Record<InterviewLanguage, string> = {
  en: 'Sure, let me repeat the question.',
  pt: 'Claro, vou repetir a pergunta.',
}
