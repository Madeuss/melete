/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/*
 * CSP for the production build (static hosts like GitHub Pages can't send headers, so it goes
 * in a meta tag). Only our own scripts run; connect-src stays open because users point the app
 * at any OpenAI-compatible URL, including http://localhost for Ollama/LM Studio.
 * Not applied in dev: Vite's dev server relies on inline scripts and websockets.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data:",
  'connect-src *',
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

function cspMeta(): Plugin {
  return {
    name: 'melete-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  }
}

// Relative base: the build works on GitHub Pages (served from /melete/) and on any static host.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), cspMeta()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'evals/**/*.test.ts'],
    restoreMocks: true,
  },
})
