import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { SettingsProvider } from '../app/SettingsProvider'
import '../i18n'

/** Renders routes inside the real providers (settings + i18n) with an in-memory router. */
export function renderRoutes(routes: Array<{ path: string; element: ReactNode }>, initialPath: string) {
  return render(
    <SettingsProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          {routes.map((r) => (
            <Route key={r.path} path={r.path} element={r.element} />
          ))}
        </Routes>
      </MemoryRouter>
    </SettingsProvider>,
  )
}
