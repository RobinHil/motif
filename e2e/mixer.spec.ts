import { expect, test, type Page } from '@playwright/test'
import { generatedCode, launchApp, type RunningApp } from './app'

let running: RunningApp

test.beforeEach(async () => {
  running = await launchApp()
})

test.afterEach(async () => {
  await running.close()
})

const screen = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Screens' }).getByRole('button', { name }).click()
const strip = (page: Page, name: string) => page.getByRole('region', { name: `${name} strip` })

test('mixer changes show in the Studio inspector and the other way round', async () => {
  const { page } = running
  await screen(page, 'Mixer')
  const fader = strip(page, 'Lead').getByRole('slider', { name: 'Lead volume' })
  await fader.focus()
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowDown')
  await expect(fader).toHaveAttribute('aria-valuenow', '0.92')

  await screen(page, 'Studio')
  await page
    .getByRole('listitem', { name: 'Lead, Notes, orbit 3' })
    .getByRole('button', { name: 'Lead', exact: true })
    .click()
  const inspector = page.getByRole('complementary', { name: 'Inspector' })
  await expect(inspector.getByRole('slider', { name: 'Volume' })).toHaveAttribute('aria-valuenow', '0.92')
  await expect.poll(() => generatedCode(page)).toContain('.gain(0.92)')

  const pan = inspector.getByRole('slider', { name: 'Pan' })
  await pan.focus()
  await page.keyboard.press('Home')
  await screen(page, 'Mixer')
  await expect(strip(page, 'Lead').getByRole('slider', { name: 'Pan' })).toHaveAttribute('aria-valuenow', '0')
})

test('adding and bypassing an effect updates the code', async () => {
  const { page } = running
  await screen(page, 'Mixer')
  const drums = strip(page, 'Drums')
  await drums.getByRole('button', { name: '+ Add effect' }).click()
  await page.getByRole('menuitem', { name: /Saturation/ }).click()
  await expect(drums.getByRole('code')).toHaveText('.shape(0.3)')

  await drums.getByRole('button', { name: /Saturation/ }).click()
  await drums.getByRole('button', { name: 'Bypass Saturation' }).click()
  await expect(drums.getByRole('button', { name: /Saturation\s*off/ })).toBeVisible()
  await expect(drums.getByRole('code')).toHaveText('(no mixer code)')

  await screen(page, 'Studio')
  await expect.poll(() => generatedCode(page)).toContain('.bank("MotifKit").orbit(1)')
})

test('the master strip turns the compressor on', async () => {
  const { page } = running
  await screen(page, 'Mixer')
  const master = strip(page, 'Master')
  await master.getByRole('button', { name: '+ Add effect' }).click()
  await page.getByRole('menuitem', { name: 'Compressor' }).click()
  await expect(master.getByRole('code')).toHaveText('master bus: gain 0.8, compressor')
})

test('spectrum and oscilloscope move while playing', async () => {
  const { page } = running
  await screen(page, 'Mixer')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  const scope = page.getByRole('img', { name: 'Output oscilloscope' })
  const first = await scope.screenshot()
  await page.waitForTimeout(400)
  const second = await scope.screenshot()
  expect(first.equals(second)).toBe(false)
})
