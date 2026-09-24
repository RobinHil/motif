import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { generateProjectCode, type GeneratedCode } from '../codegen/generate'
import { generateSongCode } from '../codegen/song'
import { initStrudelScope, playedEvents } from '../codegen/strudel-harness'
import { createDemoProject } from '../model/demo'
import type { Project } from '../model/project'
import { checkBlock, describeError, stripLabel } from './check-block'
import { Evaluator, type EngineBackend, type EvaluationResult } from './evaluator'

beforeAll(() => initStrudelScope())
afterEach(() => {
  vi.useRealTimers()
})

/** Plays nothing: records what Strudel would be asked to play, like the repl does. */
function fakePlayer(options: { rejectWhen?: (code: string) => boolean } = {}) {
  const evaluated: string[] = []
  let playing: string | null = null
  const backend: EngineBackend = {
    checkBlock,
    evaluate: (code) => {
      evaluated.push(code)
      if (options.rejectWhen?.(code)) return Promise.resolve(new Error('Strudel refused this program'))
      playing = code
      return Promise.resolve(null)
    },
  }
  return { backend, evaluated, playingCode: () => playing }
}

function withTextureCode(project: Project, code: string): Project {
  return { ...project, tracks: project.tracks.map((t) => (t.id === 'demo-texture' ? { ...t, code } : t)) }
}

describe('checkBlock', () => {
  it('accepts valid blocks, muted or not', async () => {
    await expect(checkBlock('$: s("bd sd").orbit(1)')).resolves.toBeNull()
    await expect(checkBlock('_$: note("c3").s("sine").orbit(2)')).resolves.toBeNull()
  })

  it('reports syntax errors with their line inside the block', async () => {
    const issue = await checkBlock('$: note("c3")\n  .s("sine"))')
    expect(issue?.line).toBe(2)
    expect(issue?.message).not.toMatch(/\(\d+:\d+\)$/)
  })

  it('reports unknown functions and non-pattern code', async () => {
    expect((await checkBlock('$: note("c3").lfp(300)'))?.message).toMatch(/lfp/)
    expect((await checkBlock('$: 42'))?.message).toBe('This code does not produce a pattern.')
  })

  it('strips labels and describes any thrown value', () => {
    expect(stripLabel('_$: s("bd")')).toBe('s("bd")')
    expect(stripLabel('$:s("bd")')).toBe('s("bd")')
    expect(describeError('boom')).toEqual({ message: 'boom' })
  })
})

describe('Evaluator', () => {
  const demo = () => generateProjectCode(createDemoProject(new Date(0)))

  it('evaluates the generated program when every block is valid', async () => {
    const player = fakePlayer()
    const results: EvaluationResult[] = []
    const evaluator = new Evaluator(player.backend, (r) => results.push(r))
    const generated = demo()
    evaluator.schedule(generated)
    const result = await evaluator.flush()
    expect(result).toEqual({ code: generated.code, errors: {}, globalError: null, applied: true })
    expect(results).toHaveLength(1)
    expect(await evaluator.flush()).toBeNull()
  })

  it('keeps the sound and blames the right track when free code breaks', async () => {
    const player = fakePlayer()
    const evaluator = new Evaluator(player.backend, () => undefined)
    const valid = demo()
    evaluator.schedule(valid)
    await evaluator.flush()

    const broken = generateProjectCode(withTextureCode(createDemoProject(new Date(0)), 'note("c3").lfp(300)'))
    evaluator.schedule(broken)
    const result = await evaluator.flush()

    expect(Object.keys(result?.errors ?? {})).toEqual(['demo-texture'])
    expect(result?.errors['demo-texture']?.message).toMatch(/lfp/)
    expect(result?.applied).toBe(true)
    // The texture keeps its last valid block; the other tracks are untouched.
    expect(player.playingCode()).toBe(valid.code)
    const events = await playedEvents(player.playingCode() ?? '')
    expect(new Set(events.map((e) => e.value['orbit']))).toEqual(new Set([1, 2, 3, 4]))
  })

  it('lets other tracks update while a broken track keeps its last valid version', async () => {
    const player = fakePlayer()
    const evaluator = new Evaluator(player.backend, () => undefined)
    evaluator.schedule(demo())
    await evaluator.flush()

    const project = withTextureCode(createDemoProject(new Date(0)), 'note("c3"')
    project.transport.bpm = 90
    project.tracks[1] = { ...project.tracks[1]!, mute: true } // eslint-disable-line @typescript-eslint/no-non-null-assertion -- the demo has 4 tracks
    const generated = generateProjectCode(project)
    evaluator.schedule(generated)
    const result = await evaluator.flush()

    expect(result?.code).toContain('setcpm(90/4)')
    expect(result?.code).toContain('_$: note("c2 c2 eb2 g1")')
    expect(result?.code).toContain('$: s("wind*2")')
    expect(result?.errors['demo-texture']?.line).toBe(generated.lineMap['demo-texture']?.from)
  })

  it('plays a song and keeps it playing when one track breaks', async () => {
    const player = fakePlayer()
    const evaluator = new Evaluator(player.backend, () => undefined)
    evaluator.schedule(demo())
    await evaluator.flush()
    evaluator.schedule(generateSongCode(createDemoProject(new Date(0))))
    const song = await evaluator.flush()
    expect(song?.errors).toEqual({})
    expect(song?.code).toContain('$: arrange([8, intro]')
    expect(new Set((await playedEvents(song?.code ?? '', 8, 9)).map((e) => e.value['orbit']))).toEqual(
      new Set([1, 2, 4]),
    )

    // A broken track keeps its last valid song version; the song goes on.
    const brokenSong = generateSongCode(withTextureCode(createDemoProject(new Date(0)), 'oops('))
    evaluator.schedule(brokenSong)
    const broken = await evaluator.flush()
    expect(Object.keys(broken?.errors ?? {})).toEqual(['demo-texture'])
    expect(broken?.applied).toBe(true)
    expect(broken?.code).toContain('const texture = s("wind*2")')

    // Without a valid version, the track is silence rather than a missing name.
    const fresh = new Evaluator(fakePlayer().backend, () => undefined)
    fresh.schedule(brokenSong)
    expect((await fresh.flush())?.code).toContain('const texture = silence')
    expect(stripLabel('const drums = s("bd")')).toBe('s("bd")')
  })

  it('drops a broken track that never had a valid version', async () => {
    const player = fakePlayer()
    const evaluator = new Evaluator(player.backend, () => undefined)
    evaluator.schedule(generateProjectCode(withTextureCode(createDemoProject(new Date(0)), 'oops(')))
    const result = await evaluator.flush()
    expect(result?.code).not.toContain('oops')
    expect(result?.code.split('\n').filter((l) => l.includes('.orbit('))).toHaveLength(3)
  })

  it('reports a global error and keeps the previous program when Strudel refuses the whole program', async () => {
    const player = fakePlayer({ rejectWhen: (code) => code.includes('setcpm(60/4)') })
    const evaluator = new Evaluator(player.backend, () => undefined)
    const valid = demo()
    evaluator.schedule(valid)
    await evaluator.flush()

    const project = createDemoProject(new Date(0))
    project.transport.bpm = 60
    evaluator.schedule(generateProjectCode(project))
    const result = await evaluator.flush()
    expect(result).toMatchObject({ applied: false, globalError: 'Strudel refused this program', errors: {} })
    expect(player.playingCode()).toBe(valid.code)
  })

  it('forgets removed tracks', async () => {
    const player = fakePlayer()
    const evaluator = new Evaluator(player.backend, () => undefined)
    evaluator.schedule(demo())
    await evaluator.flush()
    const withoutTexture = createDemoProject(new Date(0))
    withoutTexture.tracks.pop()
    evaluator.schedule(generateProjectCode(withoutTexture))
    await evaluator.flush()
    // Re-adding a broken texture must not bring back the old block.
    evaluator.schedule(generateProjectCode(withTextureCode(createDemoProject(new Date(0)), 'oops(')))
    const result = await evaluator.flush()
    expect(result?.code).not.toContain('wind')
  })

  it('debounces scheduled evaluations and keeps only the latest', async () => {
    vi.useFakeTimers()
    const evaluate = vi.fn(() => Promise.resolve(null))
    const results: EvaluationResult[] = []
    const evaluator = new Evaluator({ checkBlock: () => Promise.resolve(null), evaluate }, (r) => results.push(r), 150)
    const first: GeneratedCode = { code: 'a\n', header: 'setcpm(1/4)', lineMap: {}, blocks: [] }
    const second: GeneratedCode = { ...first, header: 'setcpm(2/4)' }
    evaluator.schedule(first)
    await vi.advanceTimersByTimeAsync(100)
    evaluator.schedule(second)
    await vi.advanceTimersByTimeAsync(100)
    expect(evaluate).not.toHaveBeenCalled()
    expect(evaluator.hasPending).toBe(true)
    await vi.advanceTimersByTimeAsync(60)
    expect(evaluate).toHaveBeenCalledTimes(1)
    expect(evaluate).toHaveBeenCalledWith('setcpm(2/4)\n')
    expect(results).toHaveLength(1)
  })

  it('never runs two evaluations at once', async () => {
    let active = 0
    let maxActive = 0
    const evaluate = async () => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((r) => setTimeout(r, 5))
      active--
      return null
    }
    const evaluator = new Evaluator({ checkBlock: () => Promise.resolve(null), evaluate }, () => undefined)
    const generated: GeneratedCode = { code: '', header: 'setcpm(1/4)', lineMap: {}, blocks: [] }
    const runs = []
    for (let i = 0; i < 3; i++) {
      evaluator.schedule(generated)
      runs.push(evaluator.flush())
    }
    await Promise.all(runs)
    expect(maxActive).toBe(1)
  })
})
