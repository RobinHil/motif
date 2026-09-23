import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'
import { workletFiles } from './scripts/vite-worklets'
import { PRODUCTION_CSP } from './src/shared/csp'

const shared = { '@shared': resolve(__dirname, 'src/shared') }

// The packaged renderer loads from file://, where response headers cannot be set,
// so the production CSP is injected as a meta tag. In development it is sent as a header by the main process.
function productionCsp(): Plugin {
  return {
    name: 'motif-production-csp',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: PRODUCTION_CSP },
        injectTo: 'head-prepend',
      },
    ],
  }
}

export default defineConfig({
  main: {
    resolve: { alias: shared },
  },
  preload: {
    resolve: { alias: shared },
  },
  renderer: {
    resolve: {
      alias: {
        ...shared,
        '@renderer': resolve(__dirname, 'src/renderer'),
      },
    },
    plugins: [react(), tailwindcss(), workletFiles(), productionCsp()],
  },
})
