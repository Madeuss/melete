import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import i18n from '../../i18n'
import type { EvaluatePitchInput } from '../../interview/prompts'
import { defaultSettings, type PitchFeedback } from '../../schemas'
import { getRepositories } from '../../storage/repositories'
import { renderRoutes } from '../../test/render'
import PitchPage from './PitchPage'

const evaluatePitch = vi.fn<(llm: unknown, input: EvaluatePitchInput) => Promise<PitchFeedback>>()
vi.mock('../../app/services', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../app/services')>()),
  evaluatePitch: (llm: unknown, input: EvaluatePitchInput) => evaluatePitch(llm, input),
}))

const feedback = (score: number): PitchFeedback => ({
  scores: { structure: score, relevance: score, specificity: score, conciseness: score, clarity: score },
  strengths: ['Clear current role'],
  improvements: ['Say why this role'],
  improvedVersion: 'I am a frontend engineer who [metric]…',
})

beforeEach(async () => {
  await getRepositories().data.wipe()
  await getRepositories().settings.save({
    ...defaultSettings('en'),
    stt: { kind: 'typed-only' },
    llm: { preset: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'k', model: 'm' },
  })
  await i18n.changeLanguage('en')
  evaluatePitch.mockReset()
})

it('evaluates a typed version, saves it, and compares two versions', async () => {
  evaluatePitch.mockResolvedValueOnce(feedback(2)).mockResolvedValueOnce(feedback(4))
  const user = userEvent.setup()
  renderRoutes([{ path: '/pitch', element: <PitchPage /> }], '/pitch')

  await user.type(await screen.findByLabelText(/Role/), 'Frontend engineer')
  await user.type(screen.getByLabelText('Your introduction'), 'I build web apps.')
  await user.click(screen.getByRole('button', { name: 'Evaluate and save' }))

  // The new version opens with its feedback.
  expect(await screen.findByText('A tighter version')).toBeInTheDocument()
  expect(evaluatePitch.mock.calls[0][1]).toMatchObject({ transcript: 'I build web apps.', role: 'Frontend engineer', seconds: undefined })
  expect(await screen.findByRole('heading', { name: '1 saved version' })).toBeInTheDocument()

  await user.type(screen.getByLabelText('Your introduction'), 'I am a frontend engineer who shipped a design system.')
  await user.click(screen.getByRole('button', { name: 'Evaluate and save' }))
  expect(await screen.findByRole('heading', { name: '2 saved versions' })).toBeInTheDocument()

  for (const chip of screen.getAllByRole('button', { name: 'Compare' })) await user.click(chip)
  const table = await screen.findByRole('table')
  const average = within(table).getByRole('rowheader', { name: 'Average' }).closest('tr')!
  const [before, after, change] = within(average).getAllByRole('cell')
  expect(before).toHaveTextContent('2')
  expect(after).toHaveTextContent('4')
  expect(change).toHaveTextContent('better by 2')
})

it('keeps the version when the evaluation fails', async () => {
  evaluatePitch.mockRejectedValueOnce(new Error('boom'))
  const user = userEvent.setup()
  renderRoutes([{ path: '/pitch', element: <PitchPage /> }], '/pitch')
  await user.type(await screen.findByLabelText('Your introduction'), 'I build web apps.')
  await user.click(screen.getByRole('button', { name: 'Evaluate and save' }))
  expect(await screen.findByText('The version was saved without an evaluation.')).toBeInTheDocument()
  expect(await getRepositories().pitches.list()).toHaveLength(1)
})
