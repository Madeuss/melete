/*
 * English fluency signals for non-native speakers, computed in code from what the session
 * already has: pauses while speaking, words speech recognition kept getting wrong (a hint about
 * pronunciation) and words used over and over. No model call.
 */
import type { Turn } from '../schemas'

/** Silence while answering that counts as a long pause. */
export const LONG_PAUSE_MS = 3000

export function summarizePauses(gapsMs: number[]): { count: number; longestMs: number } {
  const long = gapsMs.filter((g) => g >= LONG_PAUSE_MS)
  return { count: long.length, longestMs: long.length ? Math.max(...long) : 0 }
}

const tokens = (text: string) => text.split(/\s+/).filter(Boolean)
const norm = (word: string) => word.toLowerCase().replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '')

/**
 * What the user changed in the transcript before sending: each run of replaced words, as heard
 * by speech recognition and as meant. Punctuation and case changes don't count.
 */
export function corrections(heard: string, meant: string): Array<{ heard: string; meant: string }> {
  const a = tokens(heard)
  const b = tokens(meant)
  const an = a.map(norm)
  const bn = b.map(norm)
  // Longest common subsequence on normalized words, then walk it to find the replaced runs.
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = an[i] === bn[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const out: Array<{ heard: string; meant: string }> = []
  let removed: string[] = []
  let added: string[] = []
  const flush = () => {
    const h = removed.map(norm).filter(Boolean)
    const m = added.map(norm).filter(Boolean)
    if (h.length && m.length) out.push({ heard: h.join(' '), meant: m.join(' ') })
    removed = []
    added = []
  }
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && an[i] === bn[j]) {
      flush()
      i++
      j++
    } else if (j < b.length && (i === a.length || lcs[i][j + 1] >= lcs[i + 1][j])) {
      added.push(b[j++])
    } else {
      removed.push(a[i++])
    }
  }
  flush()
  return out
}

/** Common English words that say nothing about vocabulary range. */
const STOPWORDS = new Set(
  (
    'a an the and or but so if then than that this these those there here it its i me my mine we us our you your he him his ' +
    'she her they them their what which who whom when where why how all any both each few more most other some such no not ' +
    'only own same too very can will just do does did done doing have has had having be is am are was were been being to of ' +
    'in on at by for with about against between into through during before after above below from up down out off over under ' +
    'again further once also as because until while would could should might must shall may one two get got make made go went ' +
    'like um uh er ah yeah okay ok well really actually basically just know mean thing things lot'
  ).split(' '),
)

/** Content words used at least this many times in a session are flagged as repeated. */
export const REPEATED_MIN = 4

export interface FluencySummary {
  /** Voice answers measured, and their long pauses. */
  pauses: { answers: number; count: number; longestMs: number }
  /** Words corrected in two or more answers: speech recognition kept mishearing them. */
  pronunciation: Array<{ word: string; answers: number; heardAs: string[] }>
  /** How many words the user corrected in total. */
  corrected: number
  repeated: Array<{ word: string; count: number }>
}

export function fluencySummary(turns: Turn[]): FluencySummary {
  const spoken = turns.filter((t) => t.metrics.pauses)
  const pauses = {
    answers: spoken.length,
    count: spoken.reduce((n, t) => n + t.metrics.pauses!.count, 0),
    longestMs: Math.max(0, ...spoken.map((t) => t.metrics.pauses!.longestMs)),
  }

  const byWord = new Map<string, { answers: Set<string>; heardAs: Set<string> }>()
  let corrected = 0
  for (const t of turns) {
    for (const c of t.corrections ?? []) {
      for (const word of c.meant.split(' ')) {
        corrected++
        const entry = byWord.get(word) ?? { answers: new Set(), heardAs: new Set() }
        entry.answers.add(t.id)
        entry.heardAs.add(c.heard)
        byWord.set(word, entry)
      }
    }
  }
  const pronunciation = [...byWord]
    .filter(([, e]) => e.answers.size >= 2)
    .map(([word, e]) => ({ word, answers: e.answers.size, heardAs: [...e.heardAs] }))
    .sort((x, y) => y.answers - x.answers || x.word.localeCompare(y.word))

  const counts = new Map<string, number>()
  for (const t of turns) {
    for (const w of tokens(t.transcript).map(norm)) {
      if (w.length < 3 || STOPWORDS.has(w) || /^\d+$/.test(w)) continue
      counts.set(w, (counts.get(w) ?? 0) + 1)
    }
  }
  const repeated = [...counts]
    .filter(([, n]) => n >= REPEATED_MIN)
    .map(([word, count]) => ({ word, count }))
    .sort((x, y) => y.count - x.count || x.word.localeCompare(y.word))
    .slice(0, 8)

  return { pauses, pronunciation, corrected, repeated }
}
