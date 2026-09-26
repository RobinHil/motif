import { expect, test, type Page } from '@playwright/test'
import { generatedCode, launchApp, type RunningApp } from './app'

let running: RunningApp

test.beforeEach(async () => {
  running = await launchApp()
})

test.afterEach(async () => {
  await running.close()
})

const editor = (page: Page) => page.getByRole('textbox', { name: 'Strudel code editor' })

async function openCodeScreen(page: Page): Promise<void> {
  await page.getByRole('navigation', { name: 'Screens' }).getByRole('button', { name: 'Code' }).click()
  await expect(editor(page)).toBeVisible()
}

/** Replaces the whole editor text, as if typed, then evaluates with Ctrl+Enter. */
async function typeProgram(page: Page, edit: (code: string) => string): Promise<string> {
  const lines = await editor(page).locator('.cm-line').allTextContents()
  const next = edit(lines.join('\n'))
  await editor(page).click()
  await page.keyboard.press('Control+a')
  await page.keyboard.insertText(next)
  await page.keyboard.press('Control+Enter')
  return next
}

test('hand-editing a track in the canonical format updates the grid', async () => {
  const { page } = running
  await openCodeScreen(page)
  await typeProgram(page, (code) => code.replace('$: s(`bd ~  ~  ~', '$: s(`bd bd ~  ~'))

  await page.getByRole('navigation', { name: 'Screens' }).getByRole('button', { name: 'Studio' }).click()
  const drums = page.getByRole('listitem', { name: 'Drums, Rhythm, orbit 1' })
  await expect(drums.getByRole('gridcell', { name: 'bd step 2', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('a non-canonical edit offers conversion and never loses the typed text', async () => {
  const { page } = running
  await openCodeScreen(page)
  const typed = '.jux(rev).sometimes(x => x.fast(3)).orbit(3)'
  await typeProgram(page, (code) => code.replace('.jux(rev).orbit(3)', typed))

  const dialog = page.getByRole('dialog', { name: 'Lead no longer fits its editor' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Convert to free code' })).toBeFocused()
  await dialog.getByRole('button', { name: 'Convert to free code' }).click()

  await expect(dialog).toBeHidden()
  await expect
    .poll(() => generatedCode(page))
    .toContain(`$: n("0 2 4 <5 7> ~ 4 2 ~").scale("C:minor").s("triangle").room(0.4)${typed}`)
  await page.getByRole('navigation', { name: 'Screens' }).getByRole('button', { name: 'Studio' }).click()
  await expect(page.getByRole('listitem', { name: 'Lead, Free code, orbit 3' })).toBeVisible()
})

test('undoing a non-canonical edit restores the generated code', async () => {
  const { page } = running
  await openCodeScreen(page)
  await typeProgram(page, (code) => code.replace('$: note("c2 c2 eb2 g1")', '$: note("c2*4")'))
  await page.getByRole('dialog').getByRole('button', { name: 'Undo the change' }).click()
  await expect.poll(() => generatedCode(page)).toContain('$: note("c2 c2 eb2 g1")')
  await expect(editor(page)).toContainText('note("c2 c2 eb2 g1")')
})

test('the Fix button replaces lfp with lpf', async () => {
  const { page } = running
  await openCodeScreen(page)
  await typeProgram(page, (code) => code.replace('.degradeBy(0.3).orbit(4)', '.degradeBy(0.3).lfp(300).orbit(4)'))

  const error = page.getByRole('alert').filter({ hasText: 'Unknown function lfp. Did you mean lpf (low-pass filter)?' })
  await expect(error).toBeVisible()
  await expect(error).toContainText('Line 8')
  await error.getByRole('button', { name: 'Fix' }).click()

  await expect(error).toBeHidden()
  await expect.poll(() => generatedCode(page)).toContain('.degradeBy(0.3).lpf(300).orbit(4)')
})

test('live highlighting follows the music', async () => {
  const { page } = running
  await openCodeScreen(page)
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  const marks = editor(page).locator('.motif-play')
  await expect.poll(() => marks.count()).toBeGreaterThan(0)
  const seen = new Set<string>()
  for (let i = 0; i < 20; i++) {
    seen.add((await marks.allTextContents()).join('|'))
    await page.waitForTimeout(100)
  }
  expect(seen.size).toBeGreaterThan(4)
})

test('completes Strudel functions and documents them', async () => {
  const { page } = running
  await openCodeScreen(page)
  await editor(page).locator('.cm-line').nth(5).click()
  await page.keyboard.press('End')
  await page.keyboard.type('.ju')
  const option = page.getByRole('option', { name: /jux\s*stereo/ })
  await expect(option).toBeVisible()
  await expect(
    page.getByRole('complementary', { name: 'Documentation' }).getByRole('heading', { name: 'jux(function)' }),
  ).toBeVisible()
  // CodeMirror ignores Enter for 75 ms after the list opens, against accidental accepts.
  await page.waitForTimeout(150)
  await page.keyboard.press('Enter')
  await expect(editor(page)).toContainText('.orbit(2).jux')
})

test('direct edit in the Studio code panel reads the code back', async () => {
  const { page } = running
  await page.getByRole('group', { name: 'Code mode' }).getByRole('button', { name: 'Direct edit' }).click()
  const panel = page.getByRole('textbox', { name: 'Strudel code, editable' })
  await expect(panel).toBeVisible()
  const lines = await panel.locator('.cm-line').allTextContents()
  await panel.click()
  await page.keyboard.press('Control+a')
  await page.keyboard.insertText(lines.join('\n').replace('.room(0.4)', '.room(0.9)'))
  await page.keyboard.press('Control+Enter')
  await expect(page.getByRole('slider', { name: 'Reverb' })).toHaveCount(1)
  await page.getByRole('listitem', { name: 'Lead, Notes, orbit 3' }).getByRole('button', { name: 'Lead' }).click()
  await expect(page.getByRole('slider', { name: 'Reverb' })).toHaveAttribute('aria-valuenow', '0.9')
})
