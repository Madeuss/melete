import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it } from 'vitest'
import i18n from '../../i18n'
import { defaultSettings } from '../../schemas'
import { getRepositories } from '../../storage/repositories'
import { renderRoutes } from '../../test/render'
import NewInterviewPage from './NewInterviewPage'

beforeEach(async () => {
  localStorage.clear()
  await getRepositories().data.wipe()
  await getRepositories().settings.save({
    ...defaultSettings('en'),
    llm: { preset: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'k', model: 'm' },
  })
  await i18n.changeLanguage('en')
})

it('saves the chosen stage with the session and suggests its usual type', async () => {
  const user = userEvent.setup()
  renderRoutes(
    [
      { path: '/new', element: <NewInterviewPage /> },
      { path: '/interview/:id', element: <p>room</p> },
    ],
    '/new',
  )
  // "Technical" is both a stage and a type: each lives in its own group.
  const stage = await screen.findByRole('radiogroup', { name: 'Stage of the process' })
  const type = screen.getByRole('radiogroup', { name: 'Type' })
  await user.click(within(stage).getByRole('radio', { name: 'Technical' }))
  expect(within(type).getByRole('radio', { name: 'Technical' })).toBeChecked()
  await user.click(within(stage).getByRole('radio', { name: 'Recruiter' }))
  expect(within(type).getByRole('radio', { name: 'Behavioral' })).toBeChecked()
  await user.type(screen.getByLabelText('Role'), 'Frontend engineer')
  await user.click(screen.getByRole('button', { name: 'Start interview' }))

  expect(await screen.findByText('room')).toBeInTheDocument()
  const [session] = await getRepositories().sessions.list()
  expect(session.config).toMatchObject({ stage: 'recruiter', type: 'behavioral' })
})
