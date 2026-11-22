import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './i18n'
import './styles/index.css'
import { applyTheme, cachedThemePreference } from './styles/theme'

// Apply the last known theme before React renders, so the first paint isn't the wrong theme.
applyTheme(cachedThemePreference())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
