import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { generatedCode, launchApp, type RunningApp } from './app'

let running: RunningApp
let base: string

test.beforeEach(async () => {
  base = mkdtempSync(join(tmpdir(), 'motif-e2e-samples-'))
  running = await launchApp()
})

test.afterEach(async () => {
  await running.close()
  rmSync(base, { recursive: true, force: true })
})

/** A short mono 16-bit WAV at `frequency` Hz. */
function wav(frequency: number, seconds = 0.2): Buffer {
  const rate = 8000
  const count = Math.round(rate * seconds)
  const data = Buffer.alloc(count * 2)
  for (let i = 0; i < count; i++)
    data.writeInt16LE(Math.round(Math.sin((2 * Math.PI * frequency * i) / rate) * 12000), i * 2)
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(rate, 24)
  header.writeUInt32LE(rate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

function sampleFolder(): string {
  const dir = join(base, 'Glass Hits')
  mkdirSync(dir)
  for (let i = 1; i <= 20; i++) writeFileSync(join(dir, `hit ${String(i)}.wav`), wav(200 + i * 20))
  writeFileSync(join(dir, 'notes.txt'), 'not audio')
  writeFileSync(join(dir, 'broken.wav'), 'RIFF but not really')
  return dir
}

/** Makes the next open or save dialog answer `path`. */
async function answerDialogs(app: RunningApp['app'], path: string) {
  await app.evaluate(({ dialog }, answer) => {
    dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [answer] })
    dialog.showSaveDialog = () => Promise.resolve({ canceled: false, filePath: answer })
    // The demo has free code: a fresh profile asks before opening it. "Open anyway".
    dialog.showMessageBox = () => Promise.resolve({ response: 1, checkboxChecked: false })
  }, path)
}

async function importFolder(page: Page, dir: string) {
  await answerDialogs(running.app, dir)
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await page.getByRole('menuitem', { name: /A folder/ }).click()
}

/** Plays one second and returns what Strudel logged about `sound`: loaded, or problems. */
async function playAndListen(page: Page, sound: string): Promise<{ loaded: boolean; problems: string[] }> {
  const messages: string[] = []
  const listen = (message: { text(): string }) => messages.push(message.text())
  page.on('console', listen)
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: 'Stop', exact: true }).click()
  page.off('console', listen)
  return {
    loaded: messages.some((m) => m.includes('[sampler] load') && m.includes(sound) && m.includes('done')),
    problems: messages.filter((m) => /not found|could not load|error loading/i.test(m)),
  }
}

test('a folder of 20 WAV files becomes one sound with 20 variants, usable at once', async () => {
  const { page } = running
  await importFolder(page, sampleFolder())
  const browser = page.getByRole('complementary', { name: 'Sound browser' })
  await expect(browser.getByText('glass_hits')).toBeVisible()
  await expect(browser.getByText('20 variants')).toBeVisible()
  await expect(page.getByText(/Imported glass_hits \(20 variants, glass_hits:0 to glass_hits:19\)/)).toBeVisible()
  await expect(
    page.getByText(/Not imported: .*broken\.wav.*notes\.txt|Not imported: .*notes\.txt.*broken/),
  ).toBeVisible()

  await browser.locator('li[draggable]').filter({ hasText: 'glass_hits' }).hover()
  await browser.getByRole('button', { name: 'Use', exact: true }).click()
  await page.getByRole('gridcell', { name: 'glass_hits step 1', exact: true }).click()
  await expect.poll(() => generatedCode(page)).toMatch(/glass_hits ~/)
  expect(await playAndListen(page, 'glass_hits')).toEqual({ loaded: true, problems: [] })
})

test('a project moved to another machine still plays its imported samples', async () => {
  const { page } = running
  await importFolder(page, sampleFolder())
  const browser = page.getByRole('complementary', { name: 'Sound browser' })
  await browser.locator('li[draggable]').filter({ hasText: 'glass_hits' }).hover()
  await browser.getByRole('button', { name: 'Use', exact: true }).click()
  await page.getByRole('gridcell', { name: 'glass_hits step 1', exact: true }).click()

  const saved = join(base, 'first', 'Song.motif')
  mkdirSync(join(base, 'first'))
  await answerDialogs(running.app, saved)
  await page.keyboard.press('Control+s')
  const copies = join(saved, 'samples', 'glass_hits')
  await expect.poll(() => (existsSync(copies) ? readdirSync(copies).length : 0)).toBe(20)
  await running.close()

  // Another machine: a fresh profile with an empty library, and the project folder somewhere else.
  const moved = join(base, 'other', 'Song.motif')
  cpSync(saved, moved, { recursive: true })
  rmSync(join(base, 'first'), { recursive: true })
  rmSync(join(base, 'Glass Hits'), { recursive: true })
  running = await launchApp()
  await answerDialogs(running.app, moved)
  await running.page.keyboard.press('Control+o')
  const other = running.page
  await other.getByRole('button', { name: 'My samples', exact: true }).click()
  await expect(other.getByRole('complementary', { name: 'Sound browser' }).getByText('glass_hits')).toBeVisible()
  expect(await playAndListen(other, 'glass_hits')).toEqual({ loaded: true, problems: [] })
})
