import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import i18n from '../../i18n'
import type { StructureProfileInput } from '../../interview/prompts'
import { defaultSettings, type ProfileInput } from '../../schemas'
import { getRepositories } from '../../storage/repositories'
import { renderRoutes } from '../../test/render'
import StoryEditorPage from '../stories/StoryEditorPage'
import ProfilePage from './ProfilePage'

const structureProfile = vi.fn<(llm: unknown, input: StructureProfileInput) => Promise<ProfileInput>>()
vi.mock('../../app/services', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../app/services')>()),
  structureProfile: (llm: unknown, input: StructureProfileInput) => structureProfile(llm, input),
}))

beforeEach(async () => {
  await getRepositories().data.wipe()
  await getRepositories().settings.save({
    ...defaultSettings('en'),
    llm: { preset: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'k', model: 'm' },
  })
  await i18n.changeLanguage('en')
  structureProfile.mockReset()
})

it('organizes pasted CV text, saves the reviewed profile and turns an achievement into a story', async () => {
  structureProfile.mockResolvedValue({
    headline: 'Frontend engineer',
    experiences: [
      { company: 'Acme', title: 'Frontend Engineer', start: '2021', end: '', achievements: ['Cut checkout load time by 40%'] },
    ],
    skills: ['React'],
    education: [],
    languages: ['English, advanced'],
  })
  const user = userEvent.setup()
  renderRoutes(
    [
      { path: '/profile', element: <ProfilePage /> },
      { path: '/stories/new', element: <StoryEditorPage /> },
    ],
    '/profile',
  )

  await user.type(await screen.findByLabelText('CV text'), 'Frontend Engineer, Acme, 2021-now. Cut checkout load time by 40%.')
  await user.click(screen.getByRole('button', { name: 'Organize my CV' }))
  expect(structureProfile.mock.calls[0][1].cvText).toContain('Acme')

  // Review: fix the start date before saving.
  const start = await screen.findByLabelText('Start')
  await user.clear(start)
  await user.type(start, 'Mar 2021')
  await user.click(screen.getByRole('button', { name: 'Save profile' }))

  expect(await screen.findByText('Profile saved.')).toBeInTheDocument()
  const saved = await getRepositories().profile.get()
  expect(saved?.experiences[0]).toMatchObject({ company: 'Acme', start: 'Mar 2021' })

  await user.click(await screen.findByRole('link', { name: 'Turn into a story: Cut checkout load time by 40%' }))
  // The story assistant opens with the achievement as the starting text.
  expect(await screen.findByLabelText('Your story')).toHaveValue('Cut checkout load time by 40% (Frontend Engineer, Acme)')
})
