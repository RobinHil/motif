import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { launchApp, type RunningApp } from './app'

let running: RunningApp
let base: string

test.beforeEach(async () => {
  base = mkdtempSync(join(tmpdir(), 'motif-e2e-export-'))
  running = await launchApp()
})

test.afterEach(async () => {
  await running.close()
  rmSync(base, { recursive: true, force: true })
})

async function answerDialogs(app: RunningApp['app'], path: string) {
  await app.evaluate(({ dialog }, answer) => {
    dialog.showSaveDialog = () => Promise.resolve({ canceled: false, filePath: answer })
    dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [answer] })
  }, path)
}

async function setTempo(page: Page, bpm: number) {
  await page.getByRole('button', { name: /^Tempo/ }).focus()
  await page.keyboard.press('Enter')
  await page.keyboard.type(String(bpm))
  await page.keyboard.press('Enter')
}

/** Reads a 24-bit PCM WAV into channels of floats. */
function readWav(path: string): { rate: number; channels: Float32Array[] } {
  const buffer = readFileSync(path)
  expect(buffer.toString('ascii', 0, 4)).toBe('RIFF')
  const channelCount = buffer.readUInt16LE(22)
  const rate = buffer.readUInt32LE(24)
  expect(buffer.readUInt16LE(34)).toBe(24)
  const size = buffer.readUInt32LE(40)
  const frames = size / (3 * channelCount)
  const channels = Array.from({ length: channelCount }, () => new Float32Array(frames))
  for (let i = 0; i < frames; i++)
    for (let c = 0; c < channelCount; c++) {
      const at = 44 + (i * channelCount + c) * 3
      channels[c]![i] = buffer.readIntLE(at, 3) / 8388608 // eslint-disable-line @typescript-eslint/no-non-null-assertion -- allocated above
    }
  return { rate, channels }
}

const peak = (channel: Float32Array) => channel.reduce((max, v) => Math.max(max, Math.abs(v)), 0)

test('exports exactly the chosen cycles, with one stem per track', async () => {
  test.setTimeout(60_000)
  const { page } = running
  await setTempo(page, 400)
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Export' })
  await dialog.getByRole('radio', { name: 'Cycles', exact: true }).check()
  await dialog.getByRole('spinbutton', { name: 'Cycles to export' }).fill('2')
  await dialog.getByRole('checkbox', { name: 'One file per track (stems)' }).check()
  await answerDialogs(running.app, join(base, 'out'))
  await dialog.getByRole('button', { name: 'Export WAV' }).click()
  await expect(page.getByText(/^Exported to /)).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(/frames were missed/)).toHaveCount(0)

  const files = readdirSync(join(base, 'out')).sort()
  expect(files).toEqual(['Demo - Bass.wav', 'Demo - Drums.wav', 'Demo - Lead.wav', 'Demo - Texture.wav', 'Demo.wav'])
  const master = readWav(join(base, 'out', 'Demo.wav'))
  // 2 cycles at 400 BPM, 4 beats per cycle: 1.2 s.
  expect(master.channels[0]).toHaveLength(Math.round(1.2 * master.rate))
  expect(peak(master.channels[0]!)).toBeGreaterThan(0.05) // eslint-disable-line @typescript-eslint/no-non-null-assertion -- stereo file
  expect(master.channels[0]!.at(-1)).toBe(0) // eslint-disable-line @typescript-eslint/no-non-null-assertion -- stereo file
  // The kick on cycle 0 starts at the very beginning of the file, not after a gap.
  const drums = readWav(join(base, 'out', 'Demo - Drums.wav'))
  const firstSound = drums.channels[0]!.findIndex((v) => Math.abs(v) > 0.01) // eslint-disable-line @typescript-eslint/no-non-null-assertion -- stereo file
  expect(firstSound).toBeGreaterThanOrEqual(0)
  expect(firstSound).toBeLessThan(master.rate * 0.005)
})

test('exports the code for strudel.cc', async () => {
  const { page } = running
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Export' })
  await dialog.getByRole('button', { name: 'Code only (.js)' }).click()
  await dialog.getByRole('radio', { name: 'The loop' }).check()
  await expect(dialog.getByLabel('Exported code')).toContainText('.bank("RolandTR909")')
  const file = join(base, 'Demo.js')
  await answerDialogs(running.app, file)
  await dialog.getByRole('button', { name: 'Save .js' }).click()
  await expect.poll(() => existsSync(file)).toBe(true)
  const code = readFileSync(file, 'utf8')
  expect(code).toContain('for the Strudel REPL')
  expect(code).toContain('wind')
  expect(code).toContain('$: s("wind*2")')
})

test('records the output from the record button', async () => {
  const { page } = running
  const file = join(base, 'Take.wav')
  await answerDialogs(running.app, file)
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.getByRole('button', { name: 'Record', exact: true }).click()
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: 'Stop recording' }).click()
  await expect.poll(() => existsSync(file)).toBe(true)
  const take = readWav(file)
  expect(take.channels[0]!.length / take.rate).toBeGreaterThan(0.5) // eslint-disable-line @typescript-eslint/no-non-null-assertion -- stereo file
})
