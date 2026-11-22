import { expect, it } from 'vitest'
import { looksLikeRepeatRequest } from './repeatRequest'

it('recognizes common ways of asking for the question again', () => {
  for (const text of [
    'Sorry, could you repeat the question?',
    'can you please repeat',
    'I didn\'t get that, can you say it again',
    'could you rephrase',
    'pardon?',
    'sorry',
    'come again?',
    'desculpa, pode repetir a pergunta?',
    'não entendi a pergunta',
    '¿podría repetir?',
  ]) {
    expect(looksLikeRepeatRequest(text), text).toBe(true)
  }
})

it('does not mistake answers that mention repeating or not understanding', () => {
  for (const text of [
    'I had to repeat the deploy twice',
    "Sorry, I don't have an example of that",
    'We repeated the test until it passed',
    'Nobody understood the requirement at first so I wrote it down',
    // Long replies are answers even if they ask something.
    'In my last job the team lead would often ask could you repeat that because the calls had bad audio and we fixed it with a new setup',
  ]) {
    expect(looksLikeRepeatRequest(text), text).toBe(false)
  }
})
