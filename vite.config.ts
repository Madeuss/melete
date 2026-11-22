/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin, type ProxyOptions } from 'vite'

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

/*
 * espeak-ng (Portuguese phonemes for Kokoro) always looks for `espeak-ng.data` next to its own
 * script, ignoring locateFile. In the build its script lands in assets/, so the data goes there too,
 * under its exact name. In dev the package is served from node_modules as is (see optimizeDeps).
 */
const ESPEAK_DATA = fileURLToPath(
  new URL('./node_modules/@echogarden/espeak-ng-emscripten/espeak-ng.data', import.meta.url),
)

function espeakData(): Plugin {
  return {
    name: 'melete-espeak-data',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'assets/espeak-ng.data', source: readFileSync(ESPEAK_DATA) })
    },
  }
}

/*
 * Optional local proxy for providers that don't allow browser calls (no CORS), e.g. Magalu's AI Hub.
 * Set MELETE_DEV_PROXY=https://provider.host in .env.local, then use http://localhost:5173/proxy/v1
 * as the base URL. Only `yarn dev` and `yarn preview` have it: the deployed static site can't proxy.
 */
function devProxy(target: string | undefined): Record<string, ProxyOptions> | undefined {
  if (!target) return undefined
  return {
    '/proxy': {
      target,
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/proxy/, ''),
      // The provider sees a server-to-server call, like it would from any SDK.
      configure: (proxy) => proxy.on('proxyReq', (req) => req.removeHeader('origin')),
    },
  }
}

// Relative base: the build works on GitHub Pages (served from /melete/) and on any static host.
export default defineConfig(({ mode }) => {
  const proxy = devProxy(loadEnv(mode, process.cwd(), 'MELETE_').MELETE_DEV_PROXY)
  return {
    base: './',
    plugins: [react(), tailwindcss(), cspMeta(), espeakData()],
    // Pre-bundling would move espeak-ng's script away from its data file.
    optimizeDeps: { exclude: ['@echogarden/espeak-ng-emscripten'] },
    server: { proxy },
    preview: { proxy },
    resolve: {
      alias: {
        // The ONNX runtime's .wasm, served by the app instead of transformers.js's CDN default.
        // (The package's exports map hides dist/, so it's reached through an alias.)
        'ort-dist': fileURLToPath(new URL('./node_modules/onnxruntime-web/dist', import.meta.url)),
      },
    },
    // The Kokoro worker uses dynamic imports, which need ES module workers.
    worker: { format: 'es' },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}', 'evals/**/*.test.ts'],
      restoreMocks: true,
    },
  }
})
