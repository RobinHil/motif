import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer'),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
    // @kabelsalat/web (imported by @strudel/core) points `main` at a UMD bundle; Vite's resolver picks `module`.
    server: { deps: { inline: [/@strudel\//, /@kabelsalat\//] } },
  },
})
