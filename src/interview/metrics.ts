import type { InterviewLanguage, TurnMetrics } from '../schemas'

/*
 * Metrics computed in code, never by the LLM. Pure functions.
 * Filler lists come from the spec; each entry has a canonical label (the key in the result)
 * and a pattern that also catches common spellings from speech recognition ("umm", "uhh", "ééé").
 */

interface Filler {
  label: string
  pattern: string
}

const FILLERS: Record<InterviewLanguage, Filler[]> = {
  en: [
    { label: 'um', pattern: 'u+m+' },
    { label: 'uh', pattern: 'u+h+' },
    { label: 'like', pattern: 'like' },
    { label: 'you know', pattern: 'you\\s+know' },
    { label: 'basically', pattern: 'basically' },
    { label: 'actually', pattern: 'actually' },
    { label: 'kind of', pattern: 'kind\\s+of' },
    { label: 'sort of', pattern: 'sort\\s+of' },
    { label: 'I mean', pattern: 'i\\s+mean' },
  ],
  pt: [
    { label: 'tipo', pattern: 'tipo' },
    { label: 'né', pattern: 'né' },
    { label: 'então', pattern: 'então' },
    { label: 'aí', pattern: 'aí' },
    { label: 'éé', pattern: 'é{2,}' },
    { label: 'basicamente', pattern: 'basicamente' },
  ],
}

// \b doesn't understand accented letters, so word edges are "not a letter or digit".
const EDGE_BEFORE = '(?<![\\p{L}\\p{N}])'
const EDGE_AFTER = '(?![\\p{L}\\p{N}])'

const compiled: Record<InterviewLanguage, Array<{ label: string; re: RegExp }>> = {
  en: FILLERS.en.map((f) => ({ label: f.label, re: new RegExp(EDGE_BEFORE + f.pattern + EDGE_AFTER, 'giu') })),
  pt: FILLERS.pt.map((f) => ({ label: f.label, re: new RegExp(EDGE_BEFORE + f.pattern + EDGE_AFTER, 'giu') })),
}

export function fillerLabels(lang: InterviewLanguage): string[] {
  return FILLERS[lang].map((f) => f.label)
}

/** Count per filler; only fillers that appear are included. */
export function countFillerWords(transcript: string, lang: InterviewLanguage): Record<string, number> {
  const out: Record<string, number> = {}
  for (const { label, re } of compiled[lang]) {
    const n = transcript.match(re)?.length ?? 0
    if (n > 0) out[label] = n
  }
  return out
}

export function totalFillers(fillers: Record<string, number>): number {
  return Object.values(fillers).reduce((a, b) => a + b, 0)
}

/** Words in the transcript (letters/digits, keeping inner apostrophes and hyphens: "don't", "e-mail"). */
export function countWords(transcript: string): number {
  return transcript.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length ?? 0
}

/** wordCount / minutes, rounded. Undefined for typed answers (no duration). */
export function wordsPerMinute(wordCount: number, answerDurationMs: number | undefined): number | undefined {
  if (!answerDurationMs || answerDurationMs <= 0) return undefined
  return Math.round(wordCount / (answerDurationMs / 60000))
}

export function computeMetrics(
  transcript: string,
  lang: InterviewLanguage,
  answerDurationMs?: number,
): TurnMetrics {
  const wordCount = countWords(transcript)
  const wpm = wordsPerMinute(wordCount, answerDurationMs)
  return {
    fillerWords: countFillerWords(transcript, lang),
    wordCount,
    ...(wpm !== undefined ? { wordsPerMinute: wpm } : {}),
  }
}
