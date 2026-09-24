import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { generatedCode, launchApp, type RunningApp } from './app'
import { cc, note, useFakeMidi } from './fake-midi'

const DEVICE = 'nanoKONTROL2'
let running: RunningApp
let base: string

test.beforeEach(async () => {
  base = mkdtempSync(join(tmpdir(), 'motif-e2e-midi-'))
  running = await launchApp()
  await useFakeMidi(running.page, [DEVICE])
})

test.afterEach(async () => {
  await running.close()
  rmSync(base, { recursive: true, force: true })
})

const screen = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Screens' }).getByRole('button', { name }).click()
const inspector = (page: Page) => page.getByRole('complementary', { name: 'Inspector' })
const drumsBlock = async (page: Page) =>
  (await generatedCode(page)).split('\n').find((l) => l.includes('.orbit(1)')) ?? ''

async function answerDialogs(app: RunningApp['app'], path: string) {
  await app.evaluate(({ dialog }, answer) => {
    dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [answer] })
    dialog.showSaveDialog = () => Promise.resolve({ canceled: false, filePath: answer })
    dialog.showMessageBox = () => Promise.resolve({ response: 1, checkboxChecked: false })
  }, path)
}

test('a hardware knob controls a parameter after MIDI learn, and the mapping is saved with the project', async () => {
  const { page } = running
  const volume = inspector(page).getByRole('slider', { name: 'Volume' })
  await volume.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'MIDI learn' }).click()
  const banner = page.getByRole('status', { name: 'MIDI learn' })
  await expect(banner).toContainText('to control Drums volume')
  await expect(banner).toContainText(`Detected device: ${DEVICE}`)

  await cc(page, DEVICE, 21, 64)
  await expect(page.getByText(`CC 21 on ${DEVICE} now controls Drums volume.`)).toBeVisible()
  await banner.getByRole('button', { name: 'Done' }).click()
  await expect(banner).toBeHidden()
  await expect(inspector(page).getByText('CC 21', { exact: true })).toBeVisible()

  await cc(page, DEVICE, 21, 127)
  await expect(volume).toHaveAttribute('aria-valuenow', '1.5')
  await expect.poll(() => drumsBlock(page)).toContain('.gain(1.5)')

  const project = join(base, 'Mapped.motif')
  await answerDialogs(running.app, project)
  await page.keyboard.press('Control+s')
  await expect.poll(async () => (await import('node:fs')).existsSync(join(project, 'project.json'))).toBe(true)
  await running.close()

  // Another session: the controller is plugged in, the project opened, the knob works at once.
  const copy = join(base, 'Copy.motif')
  cpSync(project, copy, { recursive: true })
  running = await launchApp()
  await useFakeMidi(running.page, [DEVICE])
  await answerDialogs(running.app, copy)
  await expect(running.page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  await running.page.keyboard.press('Control+o')
  await expect(inspector(running.page).getByText('CC 21', { exact: true })).toBeVisible()
  await cc(running.page, DEVICE, 21, 0)
  await expect(inspector(running.page).getByRole('slider', { name: 'Volume' })).toHaveAttribute('aria-valuenow', '0')
})

test('unplugging and replugging the controller restores the mappings', async () => {
  const { page } = running
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('list', { name: 'MIDI devices' })).toContainText(`${DEVICE}Connected`)
  await page.getByRole('button', { name: 'Start MIDI learn' }).click()

  // Learn mode on the mixer: dashed controls, click the Bass fader, move a hardware fader.
  const fader = page.getByRole('slider', { name: 'Bass volume' })
  await expect(fader).toHaveAttribute('data-midi-learn', 'mappable')
  await fader.click()
  await expect(fader).toHaveAttribute('data-midi-learn', 'selected')
  await cc(page, DEVICE, 22, 10)
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('region', { name: 'Bass strip' }).getByText('CC 22')).toBeVisible()

  await page.evaluate((d) => window.fakeMidi.unplug(d), DEVICE)
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('list', { name: 'MIDI devices' })).toContainText(`${DEVICE}Unplugged`)
  await page.evaluate((d) => window.fakeMidi.plug(d), DEVICE)
  await expect(page.getByRole('list', { name: 'MIDI devices' })).toContainText(`${DEVICE}Connected`)

  await screen(page, 'Mixer')
  await cc(page, DEVICE, 22, 0)
  await expect(page.getByRole('slider', { name: 'Bass volume' })).toHaveAttribute('aria-valuenow', '0')
})

test('a MIDI keyboard records notes into the piano roll', async () => {
  const { page } = running
  await screen(page, 'Piano roll')
  await page.getByRole('combobox', { name: 'Notes track' }).selectOption({ label: 'Lead' })
  const notes = page.getByRole('img', { name: /, step \d+, \d+ steps?/ })
  await expect(notes).toHaveCount(6)
  await page.getByRole('button', { name: 'Record MIDI' }).click()
  // Stopped: step input at the cursor (step 1), 1/16 each.
  await note(page, DEVICE, 60, true)
  await note(page, DEVICE, 60, false)
  await note(page, DEVICE, 63, true)
  await note(page, DEVICE, 63, false)
  await expect(notes).toHaveCount(8)
  await expect(page.getByRole('img', { name: 'C4, step 1, 1 step' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'D#4, step 2, 1 step' })).toBeVisible()
})

test('settings change the interface scale and remember it', async () => {
  const { page, app } = running
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('combobox', { name: 'Interface scale' }).selectOption({ label: '125%' })
  await expect
    .poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.getZoomFactor()))
    .toBe(1.25)
  await page.reload()
  await expect
    .poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.getZoomFactor()))
    .toBe(1.25)
})
