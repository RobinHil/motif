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
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'scripts/**/*.ts'],
      exclude: ['**/*.test.ts', '**/test-fixtures.ts', '**/strudel-harness.ts', '**/*.d.ts'],
      reporter: ['text', 'text-summary', 'lcov'],
      // PHASES.md, phase 1: codegen/ coverage above 90%.
      thresholds: { 'src/renderer/codegen/**': { statements: 90, branches: 90, functions: 90, lines: 90 } },
    },
    // @kabelsalat/web (imported by @strudel/core) points `main` at a UMD bundle; Vite's resolver picks `module`.
    server: { deps: { inline: [/@strudel\//, /@kabelsalat\//] } },
  },
})
