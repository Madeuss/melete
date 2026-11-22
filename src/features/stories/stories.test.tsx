import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../../i18n'
import { getRepositories } from '../../storage/repositories'
import { renderRoutes } from '../../test/render'
import StoriesPage from './StoriesPage'
import StoryEditorPage from './StoryEditorPage'

const routes = [
  { path: '/stories', element: <StoriesPage /> },
  { path: '/stories/new', element: <StoryEditorPage /> },
  { path: '/stories/:storyId', element: <StoryEditorPage /> },
]

beforeEach(async () => {
  await getRepositories().data.wipe()
  await i18n.changeLanguage('en')
})

describe('story bank', () => {
  it('shows the empty state, creates a story with tags and lists it', async () => {
    const user = userEvent.setup()
    renderRoutes(routes, '/stories')

    expect(await screen.findByText('No stories yet')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: /new story/i }))

    await user.click(await screen.findByRole('button', { name: 'Save story' }))
    expect(await screen.findByText('Give the story a title')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Title'), 'Checkout outage')
    await user.type(screen.getByLabelText('Result'), 'Errors back under 0.1%')
    await user.type(screen.getByLabelText('Tags'), 'Incident Response{Enter}')
    await user.click(screen.getByRole('button', { name: 'ownership' }))
    await user.click(screen.getByRole('button', { name: 'Save story' }))

    expect(await screen.findByRole('heading', { name: 'Checkout outage' })).toBeInTheDocument()
    const stories = await getRepositories().stories.list()
    expect(stories[0].tags).toEqual(['incident-response', 'ownership'])
  })

  it('filters by tag and deletes a story after confirming', async () => {
    const repo = getRepositories().stories
    const base = { situation: '', task: '', action: '', result: '' }
    const a = await repo.create({ ...base, title: 'Conflict story', tags: ['conflict'] })
    await repo.create({ ...base, title: 'Failure story', tags: ['failure'] })
    const user = userEvent.setup()
    renderRoutes(routes, '/stories')

    await screen.findByRole('heading', { name: 'Conflict story' })
    await user.click(await screen.findByRole('button', { name: 'failure' }))
    expect(screen.queryByRole('heading', { name: 'Conflict story' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Failure story' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'failure' }))
    await user.click(screen.getByRole('link', { name: /Conflict story/ }))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(async () => expect(await repo.get(a.id)).toBeUndefined())
  })

  it('maps stories to competencies and starts a story for a missing one', async () => {
    const base = { situation: '', task: '', action: '', result: '' }
    await getRepositories().stories.create({ ...base, title: 'Checkout outage', tags: ['ownership', 'deadline'] })
    const user = userEvent.setup()
    renderRoutes(routes, '/stories?view=coverage')

    expect(await screen.findByRole('heading', { name: '8 competencies without a story' })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'Checkout outage' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Failure' }))
    // The editor opens with the competency already tagged.
    expect(await screen.findByRole('button', { name: 'Remove tag failure' })).toBeInTheDocument()
  })
})
