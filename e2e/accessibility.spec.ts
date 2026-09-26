import { expect, test, type Page } from '@playwright/test'
import { launchApp, type RunningApp } from './app'
import { axeViolations } from './axe'

let running: RunningApp

test.beforeEach(async () => {
  running = await launchApp()
  await running.page.setViewportSize({ width: 1440, height: 900 })
})

test.afterEach(async () => {
  await running.close()
})

async function expectNoViolations(page: Page, where: string) {
  const violations = await axeViolations(page)
  expect(violations.map((v) => `${where}: ${v.id} (${v.help}) at ${v.targets.slice(0, 3).join(', ')}`)).toEqual([])
}

const SCREENS = ['Studio', 'Mixer', 'Piano roll', 'Modulation', 'Arrangement', 'Code'] as const

test('every screen passes an axe audit', async () => {
  const { page } = running
  for (const name of SCREENS) {
    await page.getByRole('navigation', { name: 'Screens' }).getByRole('button', { name, exact: true }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expectNoViolations(page, name)
  }
  await page.getByRole('button', { name: 'Settings' }).click()
  await expectNoViolations(page, 'Settings')
  await page.getByRole('button', { name: /powered by Strudel/ }).click()
  await expectNoViolations(page, 'Home')
})

test('dialogs pass an axe audit', async () => {
  const { page } = running
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await expectNoViolations(page, 'Export')
  await page.keyboard.press('Escape')
  await page.keyboard.press('?')
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible()
  await expectNoViolations(page, 'Shortcut help')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /Edit sample/ }).click()
  await expectNoViolations(page, 'Sample editor')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'About Motif' }).click()
  await expectNoViolations(page, 'About')
})

test('every screen can be reached and used from the keyboard', async () => {
  const { page } = running
  for (const [index, name] of SCREENS.entries()) {
    await page.locator('body').click({ position: { x: 5, y: 890 } })
    await page.keyboard.press(String(index + 1))
    await expect(
      page.getByRole('navigation', { name: 'Screens' }).getByRole('button', { name, exact: true }),
    ).toHaveAttribute('aria-current', 'page')
    // Tab moves focus through the screen's own controls, beyond the transport bar.
    const main = page.locator('main')
    let insideMain = false
    for (let i = 0; i < 40 && !insideMain; i++) {
      await page.keyboard.press('Tab')
      insideMain = await main.evaluate((el) => el.contains(document.activeElement))
    }
    expect(insideMain, name).toBe(true)
  }
})

test('controls show the Strudel code they write when hovered', async () => {
  const { page } = running
  await page
    .getByRole('listitem', { name: 'Bass, Notes, orbit 2' })
    .getByRole('button', { name: 'Bass', exact: true })
    .click()
  const inspector = page.getByRole('complementary', { name: 'Inspector' })
  await expect(inspector.getByRole('slider', { name: 'Filter' }).locator('title')).toHaveText(
    '.lpf(sine.range(300, 1200).slow(4))',
  )
  await expect(inspector.getByRole('slider', { name: 'Reverb' }).locator('title')).toHaveText(
    '.room() is not written: Strudel plays 0',
  )
  await expect(inspector.getByRole('button', { name: /^Play in reverse/ })).toHaveAttribute('title', 'Add .rev()')
  const drums = page.getByRole('listitem', { name: 'Drums, Rhythm, orbit 1' })
  await expect(drums.getByRole('gridcell', { name: 'bd step 1', exact: true })).toHaveAttribute('title', /writes bd/)
  await expect(drums.getByRole('gridcell', { name: 'bd step 2', exact: true })).toHaveAttribute('title', /written ~/)
  await page.getByRole('navigation', { name: 'Screens' }).getByRole('button', { name: 'Mixer', exact: true }).click()
  await expect(page.getByRole('slider', { name: 'Drums volume' })).toHaveAttribute('title', '.gain(1)')
})
