import { describe, expect, it } from 'vitest'
import { createDemoProject } from '../model/demo'
import type { Project } from '../model/project'
import { generateProjectCode } from './generate'
import { automationPattern, generateSongCode, identifierFrom, songLength } from './song'
import { playedEvents } from './strudel-harness'

/** Orbits that play at least one event between `begin` and `end`. */
async function orbits(code: string, begin: number, end: number): Promise<number[]> {
  const events = await playedEvents(code, begin, end)
  return [...new Set(events.map((e) => Number(e.value['orbit'])))].sort()
}

describe('song code', () => {
  it('writes the demo song like the mockup', () => {
    const { code } = generateSongCode(createDemoProject())
    expect(code).toContain('const drums = s(`bd')
    expect(code).toContain('const texture = s("wind*2")')
    expect(code).toContain(
      [
        '// Each scene is a combination of tracks',
        'const intro  = stack(lead, texture)',
        'const verse  = stack(drums, bass, texture)',
        'const chorus = stack(drums, bass, lead, texture)',
        'const drop   = stack(drums, bass, lead)',
        'const outro  = stack(texture)',
        '',
        '$: arrange([8, intro], [16, verse], [8, chorus], [16, drop], [8, outro])',
      ].join('\n'),
    )
    expect(songLength(createDemoProject())).toBe(56)
  })

  it('plays each section with its own tracks, end to end, and loops', async () => {
    const { code } = generateSongCode(createDemoProject())
    const sections: [number, number[]][] = [
      [0, [3, 4]],
      [8, [1, 2, 4]],
      [23, [1, 2, 4]],
      [24, [1, 2, 3, 4]],
      [32, [1, 2, 3]],
      [48, [4]],
      [55, [4]],
      [56, [3, 4]],
    ]
    for (const [cycle, expected] of sections) expect(await orbits(code, cycle, cycle + 1)).toEqual(expected)
  })

  it('ramps the master automation between its points', async () => {
    const { code } = generateSongCode(createDemoProject())
    expect(code).toContain(
      '  .lpf(arrange([8, "600"], [16, saw.range(600, 2500).slow(16)], [7, saw.range(2500, 2800).slow(7)], [1, saw.range(2800, 6000)], [16, "6000"], [8, saw.range(6000, 500).slow(8)]))',
    )
    // The filter at each event's start: held at 600, rising to 2500 by cycle 24, closing to 500 by 56.
    const expected = (t: number) =>
      t < 8 ? 600 : t < 24 ? 600 + ((2500 - 600) * (t - 8)) / 16 : 6000 + ((500 - 6000) * (t - 48)) / 8
    for (const [begin, end] of [
      [4, 5],
      [16, 17],
      [50, 53],
    ] as const) {
      const events = await playedEvents(code, begin, end)
      expect(events.length).toBeGreaterThan(0)
      for (const event of events) expect(Number(event.value['cutoff'])).toBeCloseTo(expected(event.begin), 3)
    }
  })

  it('leaves muted tracks out, fills gaps with silence and follows resized sections', () => {
    const project = createDemoProject()
    const lead = project.tracks.find((t) => t.name === 'Lead')
    if (lead) lead.mute = true
    project.arrangement = [
      { id: 'a', sceneId: 'demo-scene-chorus', startCycle: 4, lengthCycles: 2 },
      { id: 'b', sceneId: 'demo-scene-intro', startCycle: 5 },
    ]
    const { code } = generateSongCode(project)
    expect(code).toContain('const chorus = stack(drums, bass, texture)')
    expect(code).toContain('const intro  = stack(texture)')
    expect(code).toContain('$: arrange([4, silence], [2, chorus], [8, intro])')
    expect(code).not.toContain('const verse')
  })

  it('names constants so they never hide a function the code uses', () => {
    const avoid = new Set(['rev', 'sine'])
    const taken = new Set<string>()
    expect(identifierFrom('Rev', taken, avoid)).toBe('rev_')
    expect(identifierFrom('Lead Synth', taken, avoid)).toBe('lead_synth')
    expect(identifierFrom('lead synth', taken, avoid)).toBe('lead_synth_2')
    expect(identifierFrom('808', taken, avoid)).toBe('t_808')
    expect(identifierFrom('new', taken, avoid)).toBe('new_')
    const project = createDemoProject()
    const texture = project.tracks.find((t) => t.name === 'Texture')
    if (texture) texture.name = 'Rev'
    expect(generateSongCode(project).code).toContain('const rev_ = s("wind*2")')
  })

  it('holds a single point, and writes nothing without points', () => {
    const one = {
      id: 'x',
      target: { trackId: 'master' as const, param: 'lpf' as const },
      points: [{ cycle: 3, value: 900 }],
    }
    expect(automationPattern(one, 16)).toBe('arrange([3, "900"], [13, "900"])')
    expect(automationPattern({ ...one, points: [] }, 16)).toBeNull()
  })

  it('evaluates twice in a row, as the engine does', async () => {
    const { code } = generateSongCode(createDemoProject())
    await playedEvents(code, 0, 1)
    expect(await orbits(code, 8, 9)).toEqual([1, 2, 4])
  })
})

describe('live scene changes', () => {
  it('switch exactly on the queued cycle', async () => {
    const project: Project = createDemoProject()
    const { code } = generateProjectCode(project, {
      sceneId: 'demo-scene-verse',
      switchAt: { cycle: 3, fromSceneId: 'demo-scene-intro' },
    })
    expect(code).toContain('.orbit(1).filterWhen(t => t >= 3)')
    expect(code).toContain('.orbit(3).filterWhen(t => t < 3)')
    expect(code).toMatch(/\.orbit\(4\)\n/)
    const events = await playedEvents(code, 2, 4)
    const before = events.filter((e) => e.begin < 3).map((e) => Number(e.value['orbit']))
    const after = events.filter((e) => e.begin >= 3).map((e) => Number(e.value['orbit']))
    expect([...new Set(before)].sort()).toEqual([3, 4])
    expect([...new Set(after)].sort()).toEqual([1, 2, 4])
    // The verse's first kick lands on the cycle boundary itself.
    expect(events.some((e) => e.begin === 3 && e.value['orbit'] === 1)).toBe(true)
  })

  it('plays only the scene once it is running', () => {
    const { code } = generateProjectCode(createDemoProject(), { sceneId: 'demo-scene-intro' })
    expect(code.match(/^_\$: /gm)).toHaveLength(2)
    expect(code).not.toContain('filterWhen')
  })
})
