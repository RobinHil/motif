// Performance measurements (SPEC 10, Performance): run on a real machine with MOTIF_PERF=1.
// CI runners have no GPU and no audio device, so their numbers would mean nothing.
import { expect, test, type Page } from '@playwright/test'
import { launchApp, type RunningApp } from './app'

test.skip(!process.env['MOTIF_PERF'], 'set MOTIF_PERF=1 to measure')

let running: RunningApp

test.afterEach(async () => {
  await running.close()
})

/** Wraps AudioContext to read its playback statistics, and counts React commits. */
async function instrument(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>
    const contexts: AudioContext[] = []
    w['perfContexts'] = contexts
    const Original = window.AudioContext
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options)
        contexts.push(this)
      }
    }
    let commits = 0
    w['perfCommits'] = () => commits
    // A stand-in for the React DevTools hook: React reports every commit to it.
    w['__REACT_DEVTOOLS_GLOBAL_HOOK__'] = {
      supportsFiber: true,
      inject: () => 1,
      onCommitFiberRoot: () => {
        commits++
      },
      onCommitFiberUnmount: () => undefined,
      onPostCommitFiberRoot: () => undefined,
      checkDCE: () => undefined,
    }
  })
}

/** Frames per second and worst frame over `ms`, React commits, and audio underruns during it. */
async function measure(page: Page, ms: number, during?: () => Promise<void>) {
  const before = await page.evaluate(() => {
    const w = window as unknown as {
      perfCommits: () => number
      perfContexts: (AudioContext & { playbackStats?: { underrunEvents: number } })[]
    }
    return {
      commits: w.perfCommits(),
      underruns: w.perfContexts.reduce((n, c) => n + (c.playbackStats?.underrunEvents ?? 0), 0),
    }
  })
  const frames = page.evaluate(
    (duration) =>
      new Promise<{ fps: number; worst: number }>((resolve) => {
        const times: number[] = []
        const tick = (t: number) => {
          times.push(t)
          if (t - (times[0] ?? t) < duration) requestAnimationFrame(tick)
          else {
            const gaps = times.slice(1).map((v, i) => v - (times[i] ?? v))
            resolve({ fps: (times.length - 1) / (duration / 1000), worst: Math.max(...gaps) })
          }
        }
        requestAnimationFrame(tick)
      }),
    ms,
  )
  await during?.()
  const result = await frames
  const after = await page.evaluate(() => {
    const w = window as unknown as {
      perfCommits: () => number
      perfContexts: (AudioContext & { playbackStats?: { underrunEvents: number } })[]
    }
    return {
      commits: w.perfCommits(),
      underruns: w.perfContexts.reduce((n, c) => n + (c.playbackStats?.underrunEvents ?? 0), 0),
    }
  })
  return {
    fps: Math.round(result.fps * 10) / 10,
    worst: Math.round(result.worst),
    commits: after.commits - before.commits,
    underruns: after.underruns - before.underruns,
  }
}

test('startup, 60 fps with 8 tracks and no audio glitches', async () => {
  test.setTimeout(120_000)
  const launched = Date.now()
  running = await launchApp()
  const { page } = running
  await expect(page.getByRole('listitem', { name: 'Drums, Rhythm, orbit 1' })).toBeVisible()
  const startup = Date.now() - launched
  // Measure again with the instruments in place (a reload is a second, warm start).
  await instrument(page)
  await page.reload()
  await page.getByRole('navigation', { name: 'Screens' }).getByRole('button', { name: 'Studio' }).click()
  await expect(page.getByRole('listitem', { name: 'Drums, Rhythm, orbit 1' })).toBeVisible()

  // 8 tracks: duplicate the 4 demo tracks.
  for (const name of ['Drums', 'Bass', 'Lead', 'Texture']) {
    await page
      .getByRole('listitem', { name: new RegExp(`^${name},`) })
      .getByRole('button', { name, exact: true })
      .click()
    await page.keyboard.press('Control+d')
  }
  await expect(page.getByRole('listitem', { name: /, orbit \d+$/ })).toHaveCount(8)
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.waitForTimeout(1500)

  const results: Record<string, Awaited<ReturnType<typeof measure>>> = {}
  for (const name of ['Studio', 'Mixer', 'Piano roll', 'Modulation', 'Arrangement', 'Code']) {
    await page.getByRole('navigation', { name: 'Screens' }).getByRole('button', { name, exact: true }).click()
    await page.waitForTimeout(500)
    results[name] = await measure(page, 4000)
  }
  // UI interaction while playing: drag a mixer fader up and down for 3 seconds.
  await page.getByRole('navigation', { name: 'Screens' }).getByRole('button', { name: 'Mixer', exact: true }).click()
  const fader = page.getByRole('slider', { name: 'Drums volume' })
  const box = await fader.boundingBox()
  results['Mixer, dragging a fader'] = await measure(page, 3000, async () => {
    if (!box) return
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    for (let i = 0; i < 60; i++)
      await page.mouse.move(box.x + box.width / 2, box.y + (i % 20) * (box.height / 20), { steps: 2 })
    await page.mouse.up()
  })
  process.stderr.write(`startup ${String(startup)} ms\n${JSON.stringify(results, null, 1)}\n`)

  expect(startup).toBeLessThan(3000)
  for (const [name, r] of Object.entries(results)) {
    expect(r.fps, name).toBeGreaterThan(55)
    expect(r.underruns, name).toBe(0)
  }
})
