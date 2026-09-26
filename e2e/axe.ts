// Accessibility audit with axe-core, injected through the DevTools protocol (the app's CSP does not
// apply there, and Electron cannot open the helper page @axe-core/playwright needs).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'

const source = readFileSync(join(process.cwd(), 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')

export interface AxeViolation {
  id: string
  impact: string | null
  help: string
  targets: string[]
}

export async function axeViolations(page: Page): Promise<AxeViolation[]> {
  await page.evaluate((code) => {
    if (!(window as unknown as { axe?: unknown }).axe) (0, eval)(code)
  }, source)
  return page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: {
          run: (
            context: Document,
            options: object,
          ) => Promise<{
            violations: { id: string; impact: string | null; help: string; nodes: { target: string[] }[] }[]
          }>
        }
      }
    ).axe
    const { violations } = await axe.run(document, { resultTypes: ['violations'] })
    return violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      targets: v.nodes.map((n) => n.target.join(' ')),
    }))
  })
}
