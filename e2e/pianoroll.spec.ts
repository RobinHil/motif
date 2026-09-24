import { expect, test, type Page } from '@playwright/test'
import { launchApp, type RunningApp } from './app'

let running: RunningApp

test.beforeEach(async () => {
  running = await launchApp()
})

test.afterEach(async () => {
  await running.close()
})

const openRoll = async (page: Page) => {
  await page.getByRole('navigation', { name: 'Screens' }).getByRole('button', { name: 'Piano roll' }).click()
  await page.getByRole('combobox', { name: 'Notes track' }).selectOption({ label: 'Lead' })
}
const roll = (page: Page) => page.getByRole('application', { name: /^Piano roll\./ })
const panel = (page: Page) => page.getByRole('complementary', { name: 'Note properties' })
const code = (page: Page) => panel(page).locator('pre')

test('the demo melody is shown and a selected note is highlighted in the code', async () => {
  const { page } = running
  await openRoll(page)
  await expect(page.getByRole('img', { name: /, step \d+, 2 steps$/ })).toHaveCount(6)
  await expect(code(page)).toContainText('n("0 2 4 <5 7> ~ 4 2 ~").scale("C:minor")')

  await page.getByRole('img', { name: /, step 7, 2 steps$/ }).click()
  await expect(code(page).locator('mark')).toHaveText('<5 7>')
  await expect(panel(page).getByText(/one per cycle/)).toBeVisible()
})

test('changing the scale only changes .scale in the code', async () => {
  const { page } = running
  await openRoll(page)
  await page.getByRole('combobox', { name: 'Scale' }).selectOption('D:dorian')
  await expect(code(page)).toContainText('n("0 2 4 <5 7> ~ 4 2 ~").scale("D:dorian")')
})

test('notes are added, moved and deleted with the keyboard', async () => {
  const { page } = running
  await openRoll(page)
  await roll(page).focus()
  await page.keyboard.press('Control+a')
  await page.keyboard.press('Delete')
  await expect(code(page)).not.toContainText('<5 7>')

  await page.keyboard.press('Enter')
  await expect(page.getByRole('img', { name: /, step 1, 1 step, selected$/ })).toHaveCount(1)
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('img', { name: /, step 2, 1 step, selected$/ })).toHaveCount(1)
  await page.keyboard.press('Control+c')
  await page.keyboard.press('Control+v')
  await expect(page.getByRole('img', { name: /, step \d+, 1 step/ })).toHaveCount(2)
})

test('a variant adds an alternation and gets its own cycle', async () => {
  const { page } = running
  await openRoll(page)
  await page.getByRole('img', { name: /, step 1, 2 steps$/ }).click()
  await panel(page).getByRole('button', { name: '+ Add variant' }).click()
  await expect(page.getByRole('button', { name: 'Cycle 2', exact: true })).toHaveAttribute('aria-pressed', 'true')

  await roll(page).focus()
  await page.keyboard.press('ArrowUp')
  await expect(code(page)).toContainText('n("<0 1> 2 4 <5 7> ~ 4 2 ~")')
})
