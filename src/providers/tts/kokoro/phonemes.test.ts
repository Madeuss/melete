import { expect, it } from 'vitest'
import { fromEspeakIpa } from './phonemes'

// Real espeak-ng (pt-br) output for "Me conte sobre uma vez em que você discordou de alguém do time".
const ESPEAK = 'm_y k_ˈo_ŋ_tʃ_y s_ˈo_b_r_i_ ˌu_m_æ v_ˈe_z ˈeɪ_ŋ k_y v_o_s_ˌe dʒ_ˌi_s_k_o_ɾ_ə_d_ˈo_w dʒ_j aʊ_ɡ_ˈeɪ_ŋ d_ʊ tʃ_ˈi_m_y'

it('joins each word’s phonemes and writes affricates as Kokoro’s single symbols', () => {
  expect(fromEspeakIpa(ESPEAK)).toBe('my kˈoŋʧy sˈobri ˌumæ vˈez ˈeɪŋ ky vosˌe ʤˌiskoɾədˈow ʤj aʊɡˈeɪŋ dʊ ʧˈimy')
})

it('only merges an affricate when espeak gave it as one phoneme', () => {
  // "t" then "ʃ" as two phonemes stays two symbols.
  expect(fromEspeakIpa('ˈa_t_ʃ_i')).toBe('ˈatʃi')
  expect(fromEspeakIpa('  ˈa_tʃ_i \n')).toBe('ˈaʧi')
})
