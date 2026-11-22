import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, it } from 'vitest'
import { SegmentedControl } from './SegmentedControl'

function Level() {
  const [value, setValue] = useState<'junior' | 'mid' | 'senior'>('mid')
  return (
    <SegmentedControl
      aria-label="Level"
      value={value}
      onChange={setValue}
      options={[
        { value: 'junior', label: 'Junior' },
        { value: 'mid', label: 'Mid' },
        { value: 'senior', label: 'Senior' },
      ]}
    />
  )
}

it('lets the keyboard reach and pick every option with Tab and Enter', async () => {
  const user = userEvent.setup()
  render(<Level />)

  await user.tab()
  expect(screen.getByRole('radio', { name: 'Junior' })).toHaveFocus()
  await user.tab()
  await user.tab()
  expect(screen.getByRole('radio', { name: 'Senior' })).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(screen.getByRole('radio', { name: 'Senior' })).toBeChecked()
})

it('still moves and picks with the arrow keys', async () => {
  const user = userEvent.setup()
  render(<Level />)

  await user.click(screen.getByRole('radio', { name: 'Mid' }))
  await user.keyboard('{ArrowLeft}')
  expect(screen.getByRole('radio', { name: 'Junior' })).toBeChecked()
  expect(screen.getByRole('radio', { name: 'Junior' })).toHaveFocus()
})
