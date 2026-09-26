import { expect, test, type Page } from '@playwright/test'
import { launchApp, type RunningApp } from './app'

let running: RunningApp

test.beforeEach(async () => {
  running = await launchApp()
})

test.afterEach(async () => {
  await running.close()
})

const openArrangement = (page: Page) =>
  page.getByRole('navigation', { name: 'Screens' }).getByRole('button', { name: 'Arrangement' }).click()
const songCode = (page: Page) => page.getByLabel('Song code')
/** A scene card: a container with its main button (name, length, state) and its track dots. */
const card = (page: Page, name: string) =>
  page
    .getByRole('list', { name: 'Scenes' })
    .locator('[data-scene-card]')
    .filter({ has: page.getByRole('button', { name: new RegExp(`^${name},`) }) })
const startCard = (page: Page, name: string) =>
  card(page, name)
    .getByRole('button', { name: new RegExp(`^${name},`) })
    .click()
/** The cycle shown in the transport bar. */
const shownCycle = async (page: Page) =>
  Number((await page.getByText(/^cycle \d/).textContent())?.replace('cycle', '').trim())

test('the demo song is arranged like the mockup and plays in song mode', async () => {
  const { page } = running
  await openArrangement(page)
  // Five scenes, then the capture card.
  await expect(page.getByRole('list', { name: 'Scenes' }).getByRole('listitem')).toHaveCount(6)
  await expect(songCode(page)).toContainText('$: arrange([8, intro], [16, verse], [8, chorus], [16, drop], [8, outro])')
  await expect(songCode(page)).toContainText('const drop   = stack(drums, bass, lead)')

  await page.getByRole('button', { name: 'Song mode' }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Intro section/ })).toHaveAttribute('data-playing', 'true')
  await expect(card(page, 'Intro')).toHaveAttribute('data-state', 'playing')
  await page.getByRole('button', { name: 'Stop', exact: true }).click()
})

test('in live mode a scene starts on the next cycle boundary', async () => {
  const { page } = running
  await openArrangement(page)
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(() => shownCycle(page)).toBeGreaterThan(0.2)

  await startCard(page, 'Chorus')
  await expect(card(page, 'Chorus')).toHaveAttribute('data-state', 'next')
  const clickedAt = await shownCycle(page)
  await expect(card(page, 'Chorus')).toHaveAttribute('data-state', 'playing', { timeout: 8000 })
  const startedAt = await shownCycle(page)
  // It waited for a boundary, and did not skip more than one.
  expect(Math.floor(startedAt)).toBeGreaterThan(Math.floor(clickedAt))
  expect(Math.floor(startedAt)).toBeLessThanOrEqual(Math.floor(clickedAt) + 2)
  await page.getByRole('button', { name: 'Stop', exact: true }).click()
})

test('scenes are captured and edited, sections moved, automations added', async () => {
  const { page } = running
  await page
    .getByRole('listitem', { name: 'Lead, Notes, orbit 3' })
    .getByRole('button', { name: 'Mute', exact: true })
    .click()
  await openArrangement(page)
  await page.getByRole('button', { name: '+ Capture current state' }).click()
  const captured = card(page, 'Scene 6')
  await expect(captured.getByRole('button', { name: 'Drums in Scene 6' })).toHaveAttribute('aria-pressed', 'true')
  await expect(captured.getByRole('button', { name: 'Lead in Scene 6' })).toHaveAttribute('aria-pressed', 'false')

  await captured.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Add to the end of the song' }).click()
  await expect(songCode(page)).toContainText('[8, outro], [8, scene_6])')

  // Move the outro to the start with the keyboard: the other sections make room.
  const outro = page.getByRole('button', { name: /^Outro section/ })
  await outro.focus()
  for (let i = 0; i < 48; i++) await page.keyboard.press('ArrowLeft')
  await expect(songCode(page)).toContainText('$: arrange([8, outro], [8, intro], [16, verse]')

  await page.getByRole('button', { name: '+ Add automation' }).click()
  await expect(page.getByRole('combobox', { name: 'Automated parameter' })).toHaveCount(2)
  await page
    .getByRole('combobox', { name: 'Automated parameter' })
    .nth(1)
    .selectOption({ label: 'Bass · Reverb (room)' })
  await expect(songCode(page)).not.toContainText('.room(')
  await expect(page.getByText('const bass = ')).toHaveCount(0)
})

test('the demo song plays end to end with its transitions, then starts again', async () => {
  test.setTimeout(90_000)
  const { page } = running
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' || /not found|could not load/i.test(message.text())) errors.push(message.text())
  })
  // 400 BPM: a cycle lasts 0.6 s, the 56-cycle song about 34 s.
  await page.getByRole('button', { name: /^Tempo/ }).focus()
  await page.keyboard.press('Enter')
  await page.keyboard.type('400')
  await page.keyboard.press('Enter')
  await openArrangement(page)
  await page.getByRole('button', { name: 'Song mode' }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  for (const name of ['Intro', 'Verse', 'Chorus', 'Drop', 'Outro', 'Intro'])
    await expect(card(page, name)).toHaveAttribute('data-state', 'playing', { timeout: 15_000 })
  await page.getByRole('button', { name: 'Stop', exact: true }).click()
  expect(errors).toEqual([])
})
