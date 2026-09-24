// Launches the built app (out/) in a fresh profile and records every request it makes.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'

export interface RunningApp {
  app: ElectronApplication
  page: Page
  requests: string[]
  close: () => Promise<void>
}

export async function launchApp(): Promise<RunningApp> {
  const userData = mkdtempSync(join(tmpdir(), 'motif-e2e-'))
  // ELECTRON_RUN_AS_NODE (set by some editors) would start Electron as plain Node.
  const { ELECTRON_RUN_AS_NODE: _runAsNode, ...inherited } = process.env
  const env: Record<string, string> = { MOTIF_E2E_USER_DATA: userData }
  for (const [key, value] of Object.entries(inherited)) if (value !== undefined) env[key] = value
  const app = await electron.launch({ args: ['.'], env })
  const requests: string[] = []
  app.context().on('request', (request) => requests.push(request.url()))
  const page = await app.firstWindow()
  page.on('request', (request) => requests.push(request.url()))
  await page.waitForLoadState('domcontentloaded')
  return {
    app,
    page,
    requests,
    close: async () => {
      // An edited project would ask "Quit without saving?"; tests throw their profile away anyway.
      const closed = app.waitForEvent('close')
      await app
        .evaluate(({ app: electronApp }) => {
          electronApp.exit(0)
        })
        .catch(() => undefined)
      await closed
      rmSync(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    },
  }
}

/** The generated code panel, read from CodeMirror (in an open shadow root, which locators pierce). */
export async function generatedCode(page: Page): Promise<string> {
  const lines = await page.locator('.cm-content .cm-line').allTextContents()
  return lines.join('\n')
}
