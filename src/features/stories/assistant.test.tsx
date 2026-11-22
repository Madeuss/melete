import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import i18n from '../../i18n'
import type { StructureStoryInput, StructureStoryOutput } from '../../interview/prompts'
import { defaultSettings } from '../../schemas'
import { getRepositories } from '../../storage/repositories'
import { renderRoutes } from '../../test/render'
import StoryEditorPage from './StoryEditorPage'

const structureStory = vi.fn<(llm: unknown, input: StructureStoryInput) => Promise<StructureStoryOutput>>()
vi.mock('../../app/services', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../app/services')>()),
  structureStory: (llm: unknown, input: StructureStoryInput) => structureStory(llm, input),
}))

beforeEach(async () => {
  await getRepositories().data.wipe()
  await getRepositories().settings.save({
    ...defaultSettings('en'),
    llm: { preset: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'k', model: 'm' },
  })
  await i18n.changeLanguage('en')
  structureStory.mockReset()
})

it('fills the STAR fields from a loose story, asks what is missing and refines with the answers', async () => {
  structureStory
    .mockResolvedValueOnce({
      title: 'Black Friday checkout outage',
      situation: 'Checkout broke on Black Friday.',
      task: 'I was asked to fix it.',
      action: 'I rolled back the release.',
      result: '',
      tags: ['ownership'],
      missing: ['How did it end, with a number?'],
    })
    .mockResolvedValueOnce({
      title: 'ignored',
      situation: 'Checkout broke on Black Friday.',
      task: 'I was asked to fix it.',
      action: 'I rolled back the release.',
      result: 'Errors dropped from 4% to 0.1% in ten minutes.',
      tags: ['deadline'],
      missing: [],
    })
  const user = userEvent.setup()
  renderRoutes([{ path: '/stories/new', element: <StoryEditorPage /> }], '/stories/new')

  await user.click(await screen.findByRole('button', { name: 'Tell the story' }))
  await user.type(screen.getByLabelText('Your story'), 'checkout broke on black friday, I rolled back')
  await user.click(screen.getByRole('button', { name: 'Organize into STAR' }))

  expect(await screen.findByLabelText('Title')).toHaveValue('Black Friday checkout outage')
  expect(screen.getByLabelText('Action')).toHaveValue('I rolled back the release.')
  await user.type(screen.getByLabelText('How did it end, with a number?'), 'errors 4% to 0.1%')
  await user.click(screen.getByRole('button', { name: 'Add my answers' }))

  await waitFor(() => expect(screen.getByLabelText('Result')).toHaveValue('Errors dropped from 4% to 0.1% in ten minutes.'))
  expect(screen.getByLabelText('Title')).toHaveValue('Black Friday checkout outage') // a title is kept once set
  expect(structureStory.mock.calls[1][1].answers).toEqual([
    { question: 'How did it end, with a number?', answer: 'errors 4% to 0.1%' },
  ])
  expect(await screen.findByText('Nothing important is missing.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Remove tag ownership' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Remove tag deadline' })).toBeInTheDocument()
})
