import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Route, Routes } from 'react-router'
import './styles/index.css'
import { applyTheme, cachedThemePreference } from './styles/theme'

applyTheme(cachedThemePreference())

// Dev-only: the import is behind import.meta.env.DEV so the page is tree-shaken out of production.
const StyleguidePage = import.meta.env.DEV ? lazy(() => import('./features/styleguide/StyleguidePage')) : null

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Suspense>
        <Routes>
          {StyleguidePage && <Route path="/styleguide" element={<StyleguidePage />} />}
          <Route path="*" element={<p className="p-8">melete</p>} />
        </Routes>
      </Suspense>
    </HashRouter>
  </StrictMode>,
)
