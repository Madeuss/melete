/** Kokoro writes these affricates as single symbols (Kokoro's Python pipeline maps them the same way). */
const AFFRICATES: Record<string, string> = { 'tʃ': 'ʧ', 'dʒ': 'ʤ' }

/**
 * espeak-ng's IPA → Kokoro's phoneme string. espeak separates the phonemes of each word with "_"
 * (the same format Python's phonemizer reads). Affricates are mapped per phoneme, so a "t" followed
 * by an "ʃ" from another phoneme isn't merged; then the separators go.
 */
export function fromEspeakIpa(ipa: string): string {
  return ipa
    .trim()
    .split(/\s+/)
    .map((word) =>
      word
        .split('_')
        .map((phoneme) => AFFRICATES[phoneme] ?? phoneme)
        .join(''),
    )
    .join(' ')
    .replace(/[̩̪]/g, '') // syllabic and dental marks Kokoro doesn't use
}
