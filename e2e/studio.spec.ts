import { expect, test } from '@playwright/test'
import { generatedCode, launchApp, type RunningApp } from './app'

let running: RunningApp

test.beforeEach(async () => {
  running = await launchApp()
})

test.afterEach(async () => {
  await running.close()
})

test('opens the demo in the Studio on first launch', async () => {
  const { page } = running
  await expect(
    page.getByRole('navigation', { name: 'Screens' }).getByRole('button', { name: 'Studio' }),
  ).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('list', { name: 'Tracks' }).getByRole('listitem')).toHaveCount(4)
  await expect.poll(() => generatedCode(page)).toContain('$: n("0 2 4 <5 7> ~ 4 2 ~").scale("C:minor")')
})

test('create a track, enable 4 steps, check the generated code', async () => {
  const { page } = running
  await page.getByRole('button', { name: '+ Add track' }).click()
  await page.getByRole('menuitem', { name: /Rhythm/ }).click()

  const track = page.getByRole('listitem', { name: 'Rhythm 5, Rhythm, orbit 5' })
  await expect(track).toBeVisible()
  for (const step of [1, 5, 9, 13]) {
    await track.getByRole('gridcell', { name: `bd step ${String(step)}`, exact: true }).click()
  }
  await expect(track.getByRole('gridcell', { name: 'bd step 5', exact: true })).toHaveAttribute('aria-pressed', 'true')

  const expected = [
    '$: s(`bd ~  ~  ~  bd ~  ~  ~  bd ~  ~  ~  bd ~  ~  ~ ,',
    '      ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~ ,',
    '      ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~ `).bank("MotifKit").orbit(5)',
  ].join('\n')
  await expect.poll(() => generatedCode(page)).toContain(expected)
})

test('edits with the keyboard only: steps, mute and undo', async () => {
  const { page } = running
  const drums = page.getByRole('listitem', { name: 'Drums, Rhythm, orbit 1' })
  const first = drums.getByRole('gridcell', { name: 'bd step 1', exact: true })
  await first.focus()
  await page.keyboard.press('ArrowRight')
  await expect(drums.getByRole('gridcell', { name: 'bd step 2', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(drums.getByRole('gridcell', { name: 'bd step 2', exact: true })).toHaveAttribute('aria-pressed', 'true')

  await page.keyboard.press('m')
  await expect(drums.getByRole('button', { name: 'Mute' })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => generatedCode(page)).toContain('_$: s(`bd bd')

  await page.keyboard.press('Control+z')
  await page.keyboard.press('Control+z')
  await expect(drums.getByRole('gridcell', { name: 'bd step 2', exact: true })).toHaveAttribute('aria-pressed', 'false')
})

test('makes zero outbound requests', async () => {
  const { page, requests } = running
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.getByRole('button', { name: 'Preview bd' }).click()
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: 'Stop', exact: true }).click()

  const remote = requests.filter((url) => /^(https?|wss?):/.test(url))
  expect(remote).toEqual([])
  expect(requests.some((url) => url.startsWith('motif-sample://'))).toBe(true)
})
