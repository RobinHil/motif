import { expect, test, type Page } from '@playwright/test'
import { launchApp, type RunningApp } from './app'

let running: RunningApp

test.beforeEach(async () => {
  running = await launchApp()
})

test.afterEach(async () => {
  await running.close()
})

const inspectorKnob = async (page: Page, track: string, orbit: number, knob: string) => {
  await page
    .getByRole('listitem', { name: `${track}, Notes, orbit ${String(orbit)}` })
    .getByRole('button', { name: track, exact: true })
    .click()
  await page
    .getByRole('complementary', { name: 'Inspector' })
    .getByRole('slider', { name: knob })
    .click({ button: 'right' })
}
const trackCode = (page: Page) => page.getByLabel('Track code')

test('a knob opens its animation and every setting shows in the code', async () => {
  const { page } = running
  await inspectorKnob(page, 'Bass', 2, 'Filter')
  await page.getByRole('menuitem', { name: 'Edit animation' }).click()
  await expect(page.getByRole('heading', { name: 'Animate: Low-pass filter' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Sine/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(trackCode(page).locator('mark')).toHaveText('.lpf(sine.range(300, 1200).slow(4))')

  await page.getByRole('button', { name: /^Square/ }).click()
  await page.getByRole('button', { name: '8 cycles' }).click()
  await expect(trackCode(page).locator('mark')).toHaveText('.lpf(square.range(300, 1200).slow(8))')

  await page.getByRole('button', { name: /^Sequence/ }).click()
  await expect(trackCode(page).locator('mark')).toHaveText('.lpf("<300 689 1200 455>")')
  await page.getByRole('button', { name: '+ Add cycle' }).click()
  await page.getByRole('group', { name: 'Value per cycle' }).getByRole('spinbutton').last().fill('900')
  await expect(trackCode(page).locator('mark')).toHaveText('.lpf("<300 689 1200 455 900>")')
})

test('a fixed knob gets animated, then frozen', async () => {
  const { page } = running
  await inspectorKnob(page, 'Lead', 3, 'Reverb')
  await page.getByRole('menuitem', { name: 'Animate' }).click()
  await expect(page.getByRole('heading', { name: 'Animate: Reverb' })).toBeVisible()
  await page.getByRole('button', { name: /^Triangle/ }).click()
  await expect(trackCode(page).locator('mark')).toHaveText('.room(tri.range(0, 0.6).slow(4))')
  await expect(page.getByRole('button', { name: /Lead · Reverb/ })).toBeVisible()

  await page.getByRole('button', { name: 'Freeze' }).click()
  await expect(trackCode(page)).toContainText('.room(0)')
  await expect(page.getByRole('button', { name: /Lead · Reverb/ })).toHaveCount(0)
})

test('an animated knob moves during playback', async () => {
  const { page } = running
  await page
    .getByRole('listitem', { name: 'Bass, Notes, orbit 2' })
    .getByRole('button', { name: 'Bass', exact: true })
    .click()
  await page.getByRole('navigation', { name: 'Screens' }).getByRole('button', { name: 'Modulation' }).click()
  const dot = page.locator('[aria-current="true"] [data-modulation-dot]')
  await expect(dot).toHaveAttribute('visibility', 'hidden')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(dot).toHaveAttribute('visibility', 'visible')
  const first = await dot.getAttribute('cx')
  await expect.poll(() => dot.getAttribute('cx')).not.toBe(first)
  await page.getByRole('button', { name: 'Stop', exact: true }).click()
})
