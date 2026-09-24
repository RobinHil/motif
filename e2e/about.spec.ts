import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { launchApp, type RunningApp } from './app'

let running: RunningApp | null = null
let base: string

test.beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'motif-e2e-about-'))
})

test.afterEach(async () => {
  await running?.close()
  rmSync(base, { recursive: true, force: true })
})

test('the About window shows the version, the credits and the licenses', async () => {
  running = await launchApp()
  const { page } = running
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'About Motif' }).click()
  const about = page.getByRole('dialog', { name: /^Motif \d+\.\d+\.\d+$/ })
  await expect(about).toContainText('Strudel')
  await expect(about).toContainText('TidalCycles')
  await expect(about).toContainText('GNU Affero General Public License')
  await expect(about.getByLabel('Licenses')).toContainText('CC0-1.0')
  await expect(about.getByLabel('Licenses')).toContainText('@strudel/core')
  await about.getByRole('button', { name: 'Close' }).click()
  await expect(about).toBeHidden()
})

test('a .motif folder given at launch opens, like a double-click in the file manager', async () => {
  const dir = join(base, 'Handed Over.motif')
  mkdirSync(join(dir, 'samples'), { recursive: true })
  // An earlier session saves an empty project there.
  running = await launchApp()
  await running.app.evaluate(({ dialog }, answer) => {
    dialog.showSaveDialog = () => Promise.resolve({ canceled: false, filePath: answer })
  }, dir)
  await expect(running.page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  await running.page.keyboard.press('Control+n')
  await running.page.keyboard.press('Control+s')
  await expect.poll(() => existsSync(join(dir, 'project.json'))).toBe(true)
  await running.close()

  running = await launchApp({ args: [dir] })
  await expect(running.page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  // The demo's tracks are gone: the empty project from the folder is open.
  await expect(running.page.getByRole('listitem', { name: /^Drums,/ })).toHaveCount(0)
})
