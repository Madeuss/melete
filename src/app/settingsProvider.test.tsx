import { act, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { beforeEach, expect, it } from 'vitest'
import { getRepositories } from '../storage/repositories'
import { SettingsProvider } from './SettingsProvider'
import { useSettings, type SettingsContextValue } from './settingsContext'

const probe: { ctx?: SettingsContextValue } = {}
function Probe() {
  const ctx = useSettings()
  useEffect(() => {
    probe.ctx = ctx
  })
  return <p>{`${ctx.settings.stt.kind}/${ctx.settings.tts.kind}`}</p>
}

beforeEach(async () => {
  await getRepositories().data.wipe()
})

it('applies quick successive updates on top of each other', async () => {
  render(
    <SettingsProvider>
      <Probe />
    </SettingsProvider>,
  )
  expect(await screen.findByText('web-speech/browser')).toBeInTheDocument()

  await act(async () => {
    // Fired in the same tick, like two clicks before a re-render.
    const a = probe.ctx!.update({ stt: { kind: 'typed-only' } })
    const b = probe.ctx!.update((s) => ({ ...s, tts: { ...s.tts, kind: 'off' } }))
    await Promise.all([a, b])
  })

  expect(screen.getByText('typed-only/off')).toBeInTheDocument()
  const saved = await getRepositories().settings.get()
  expect(saved?.stt.kind).toBe('typed-only')
  expect(saved?.tts.kind).toBe('off')
})
