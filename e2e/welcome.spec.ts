import { expect, test } from '@playwright/test'
import { generatedCode, launchApp, type RunningApp } from './app'

let running: RunningApp

test.afterEach(async () => {
  await running.close()
})

test('first launch opens "demo" and invites to the tutorial until the cross closes it for good', async () => {
  running = await launchApp({ firstLaunch: true })
  const { page } = running
  await expect(page.getByRole('list', { name: 'Tracks' }).getByRole('listitem')).toHaveCount(11)
  await expect.poll(() => generatedCode(page)).toContain('setcpm(155/4)')
  await expect(page.getByRole('listitem', { name: 'Kick, Rhythm, orbit 1' })).toBeVisible()
  const invitation = page.getByRole('region', { name: 'Tutorial invitation' })
  await expect(invitation).toBeVisible()

  // "demo" is a saved project of its own, in the recent projects.
  await page.getByRole('button', { name: /powered by Strudel/ }).click()
  await expect(page.getByRole('region', { name: 'Recent projects' })).toContainText('demo')

  await invitation.getByRole('button', { name: 'Close the invitation for good' }).click()
  await expect(invitation).toBeHidden()
  await page.reload()
  await page.getByRole('navigation', { name: 'Screens' }).getByRole('button', { name: 'Studio' }).click()
  await expect(page.getByRole('region', { name: 'Tutorial invitation' })).toHaveCount(0)
})

test('the tutorial builds the tek track step by step, and plays it as a song', async () => {
  test.setTimeout(90_000)
  running = await launchApp({ firstLaunch: true })
  const { page } = running
  await page.getByRole('button', { name: 'Start the tutorial' }).click()
  const tutorial = page.getByRole('region', { name: 'Tutorial' })
  await expect(tutorial).toContainText('Step 1 of 15')
  await expect(page.getByRole('listitem', { name: /, orbit \d+$/ })).toHaveCount(0)

  // Step 1 by hand: the tempo pill.
  await page.getByRole('button', { name: /^Tempo/ }).focus()
  await page.keyboard.press('Enter')
  await page.keyboard.type('150')
  await page.keyboard.press('Enter')
  await expect(tutorial.getByRole('status')).toHaveText('Done. On to the next step.')
  await tutorial.getByRole('button', { name: 'Next' }).click()

  // The rest with "Do it for me", each step opening its screen.
  for (let step = 2; step <= 15; step++) {
    await expect(tutorial).toContainText(`Step ${String(step)} of 15`)
    await expect(tutorial.getByRole('button', { name: 'Next' })).toBeDisabled()
    await tutorial.getByRole('button', { name: 'Do it for me' }).click()
    await expect(tutorial.getByRole('button', { name: 'Next' })).toBeEnabled()
    await tutorial.getByRole('button', { name: 'Next' }).click()
  }
  await expect(tutorial).toContainText('Your track is ready')
  await tutorial.getByRole('button', { name: 'Play the song' }).click()
  await expect(tutorial).toBeHidden()
  await expect(page.getByLabel('Song code')).toContainText(
    '$: arrange([16, intro], [8, build], [16, drop], [16, acid_solo], [16, breakdown], [8, build_2], [16, drop_2], [16, rampage], [16, finale], [8, outro])',
  )
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Intro section/ })).toHaveAttribute('data-playing', 'true')
  // The invitation does not come back once the tutorial is done.
  await expect(page.getByRole('region', { name: 'Tutorial invitation' })).toHaveCount(0)
})
