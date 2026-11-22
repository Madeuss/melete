import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it } from 'vitest'
import i18n from '../../i18n'
import { getRepositories } from '../../storage/repositories'
import { renderRoutes } from '../../test/render'
import { LanguageSection } from './PreferencesSection'

beforeEach(async () => {
  await getRepositories().data.wipe()
  await i18n.changeLanguage('en')
})

// Regression: the selects used to read e.target.value inside the queued updater, after React had
// already reset the controlled select, so every choice was saved as the old value.
it('saves the option picked in a settings select', async () => {
  const user = userEvent.setup()
  renderRoutes([{ path: '/', element: <LanguageSection /> }], '/')

  const select = await screen.findByLabelText('Interview')
  await user.selectOptions(select, 'pt')

  await waitFor(async () => expect((await getRepositories().settings.get())?.interviewLanguage).toBe('pt'))
  expect(select).toHaveValue('pt')
})
