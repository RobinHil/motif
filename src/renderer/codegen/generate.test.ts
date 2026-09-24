import { describe, expect, it } from 'vitest'
import { createDemoProject } from '../model/demo'
import { createTransform } from '../model/defaults'
import { SIGNAL_SHAPES, TRANSFORM_TYPES, type Track } from '../model/project'
import { generateProjectCode, generateTrackCode } from './generate'
import { playedEvents } from './strudel-harness'
import { codeTrack, HIT, note, notesTrack, project, stepRow, stepsTrack } from './test-fixtures'

const block = (track: Track, muted = false) => generateTrackCode(track, muted)

describe('generateProjectCode', () => {
  it('generates the demo project exactly', () => {
    const { code, lineMap } = generateProjectCode(createDemoProject(new Date(0)))
    expect(code).toBe(
      [
        'setcpm(120/4)',
        '',
        '$: s(`bd ~  ~  ~  ~  ~  ~  ~  bd ~  bd ~  ~  ~  ~  ~ ,',
        '      ~  ~  ~  ~  sd ~  ~  ~  ~  ~  ~  ~  sd ~  ~  ~ ,',
        '      hh ~  hh ~  hh ~  hh ~  hh ~  hh ~  hh ~  hh hh`).bank("MotifKit").orbit(1)',
        '$: note("c2 c2 eb2 g1").s("sawtooth").lpf(sine.range(300, 1200).slow(4)).orbit(2)',
        '$: n("0 2 4 <5 7> ~ 4 2 ~").scale("C:minor").s("triangle").room(0.4).jux(rev).orbit(3)',
        '$: s("wind*2").speed(perlin.range(0.5, 1.5)).chop(8).degradeBy(0.3).orbit(4)',
        '',
      ].join('\n'),
    )
    expect(lineMap).toEqual({
      'demo-drums': { from: 3, to: 5 },
      'demo-bass': { from: 6, to: 6 },
      'demo-lead': { from: 7, to: 7 },
      'demo-texture': { from: 8, to: 8 },
    })
  })

  it('is deterministic', () => {
    const a = generateProjectCode(createDemoProject(new Date(0)))
    const b = generateProjectCode(createDemoProject(new Date(5)))
    expect(a).toEqual(b)
  })

  it('produces code that Strudel evaluates, for the demo project', async () => {
    const events = await playedEvents(generateProjectCode(createDemoProject()).code)
    const sounds = new Set(events.map((e) => e.value['s']))
    expect(sounds).toEqual(new Set(['bd', 'sd', 'hh', 'sawtooth', 'triangle', 'wind']))
  })

  it('writes only the tempo line for an empty project', () => {
    expect(generateProjectCode(project([])).code).toBe('setcpm(120/4)\n')
    expect(generateProjectCode(project([], { transport: { bpm: 97.5, beatsPerCycle: 3 } })).code).toBe(
      'setcpm(97.5/3)\n',
    )
  })

  it('mutes with _$: and keeps line numbers', () => {
    const tracks = [stepsTrack([stepRow('bd', [0])], { mute: true }), codeTrack('s("hh")')]
    const { code, lineMap } = generateProjectCode(project(tracks))
    expect(code.split('\n')[2]).toMatch(/^_\$: s\(`/)
    expect(code.split('\n')[3]).toBe('$: s("hh").orbit(3)')
    expect(lineMap).toEqual({ steps: { from: 3, to: 3 }, code: { from: 4, to: 4 } })
  })

  it('mutes every other track when one is soloed', () => {
    const tracks = [
      codeTrack('s("bd")', { id: 'a', orbit: 1, solo: true }),
      codeTrack('s("sd")', { id: 'b', orbit: 2 }),
      codeTrack('s("hh")', { id: 'c', orbit: 3, solo: true, mute: true }),
    ]
    const lines = generateProjectCode(project(tracks)).code.split('\n')
    expect(lines.slice(2, 5)).toEqual(['$: s("bd").orbit(1)', '_$: s("sd").orbit(2)', '_$: s("hh").orbit(3)'])
  })

  it('mutes tracks outside the requested scene', () => {
    const tracks = [codeTrack('s("bd")', { id: 'a', orbit: 1 }), codeTrack('s("sd")', { id: 'b', orbit: 2 })]
    const scenes = [{ id: 'intro', name: 'Intro', lengthCycles: 8, activeTrackIds: ['b'] }]
    const { code } = generateProjectCode(project(tracks, { scenes }), { sceneId: 'intro' })
    expect(code.split('\n').slice(2, 4)).toEqual(['_$: s("bd").orbit(1)', '$: s("sd").orbit(2)'])
    expect(() => generateProjectCode(project(tracks), { sceneId: 'nope' })).toThrow('Unknown scene')
  })
})

describe('step tracks', () => {
  it('aligns rows in a multi-line string and plays the grid', async () => {
    const track = stepsTrack([stepRow('bd', [0, 8]), stepRow('sd', [4, 12])])
    expect(block(track)).toBe(
      [
        '$: s(`bd ~  ~  ~  ~  ~  ~  ~  bd ~  ~  ~  ~  ~  ~  ~ ,',
        '      ~  ~  ~  ~  sd ~  ~  ~  ~  ~  ~  ~  sd ~  ~  ~ `).bank("RolandTR909").orbit(1)',
      ].join('\n'),
    )
    const events = await playedEvents(block({ ...track, source: { type: 'sample', name: 'x' } }))
    expect(events.map((e) => `${String(e.begin)} ${String(e.value['s'])}`)).toEqual([
      '0 bd',
      '0.25 sd',
      '0.5 bd',
      '0.75 sd',
    ])
  })

  it('aligns continuation lines under a muted prefix', () => {
    const code = block(stepsTrack([stepRow('bd', [0]), stepRow('sd', [1])]), true)
    expect(code.split('\n')[1]?.indexOf('~')).toBe('_$: s(`'.length)
  })

  it('writes variants and the chance to drop, widening the column', async () => {
    const track = stepsTrack([stepRow('bd', [0], { velocity: 1, probability: 0.3 }, 3), stepRow('hh', [0, 1])])
    const [first, second] = block(track).split('\n')
    expect(first).toBe('$: s(`bd:3?0.7 ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~ ,')
    expect(second).toBe('      hh       hh ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~ `).bank("RolandTR909").orbit(1)')
    // Probability 0.3 is the chance to play: about 19 kicks over 64 cycles.
    const events = await playedEvents(block(track), 0, 64)
    const kicks = events.filter((e) => e.value['s'] === 'bd')
    expect(kicks.every((e) => e.value['n'] === 3)).toBe(true)
    expect(kicks.length).toBeGreaterThan(8)
    expect(kicks.length).toBeLessThan(32)
  })

  it('switches to one pattern per row when velocities vary', async () => {
    const soft = { velocity: 0.5, probability: 1 }
    const steps = stepRow('hh', [0, 1])
    steps.steps[1] = soft
    const track = stepsTrack([stepRow('bd', [0]), steps])
    // The 0.5 velocity makes the second column 3 wide in both rows.
    expect(block(track)).toBe(
      [
        '$: stack(',
        '  s(`bd ~   ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~ `),',
        '  s(`hh hh  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~ `).velocity(`1  0.5 ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~ `)',
        ').bank("RolandTR909").orbit(1)',
      ].join('\n'),
    )
    const events = await playedEvents(block(track))
    expect(events.map((e) => [e.begin, e.value['s'], e.value['velocity'] ?? null])).toEqual([
      [0, 'bd', null],
      [0, 'hh', 1],
      [0.0625, 'hh', 0.5],
    ])
  })

  it('writes s("~") without rows and ignores non-bank sources', () => {
    expect(block(stepsTrack([]))).toBe('$: s("~").bank("RolandTR909").orbit(1)')
    expect(block(stepsTrack([stepRow('bd', [0])], { source: { type: 'synth', name: 'sine' } }))).not.toContain('.s(')
  })
})

describe('note tracks', () => {
  it('writes rests and uses the coarsest grid', () => {
    const notes = [note(0, 4, 'c3'), note(8, 4, 'e3')]
    expect(block(notesTrack(notes))).toBe('$: note("c3 ~ e3 ~").s("sawtooth").orbit(2)')
    expect(block(notesTrack([]))).toBe('$: note("~").s("sawtooth").orbit(2)')
  })

  it('writes long notes with weights', async () => {
    const code = block(notesTrack([note(0, 3, 'c3'), note(3, 1, 'e3'), note(8, 8, 'g3')]))
    expect(code).toBe('$: note("c3@3 e3 ~ ~ ~ ~ g3@8").s("sawtooth").orbit(2)')
    const events = await playedEvents(code)
    expect(events.map((e) => [e.begin, e.value['note']])).toEqual([
      [0, 'c3'],
      [0.1875, 'e3'],
      [0.5, 'g3'],
    ])
  })

  it('writes chords low to high', async () => {
    const code = block(notesTrack([note(0, 8, 'g3'), note(0, 8, 'c3'), note(0, 8, 'eb3'), note(8, 8, 'f3')]))
    expect(code).toBe('$: note("[c3,eb3,g3] f3").s("sawtooth").orbit(2)')
    expect((await playedEvents(code)).filter((e) => e.begin === 0)).toHaveLength(3)
  })

  it('puts overlapping notes that do not start together on separate layers', () => {
    const code = block(notesTrack([note(0, 8, 'c3'), note(4, 4, 'e3'), note(0, 4, 'c4')]))
    expect(code).toBe('$: note("c3 ~, c4 e3 ~ ~").s("sawtooth").orbit(2)')
  })

  it('writes per-cycle alternatives', async () => {
    const code = block(notesTrack([note(0, 16, 'c3', { alternatives: ['d3', 'e3'] })]))
    expect(code).toBe('$: note("<c3 d3 e3>").s("sawtooth").orbit(2)')
    const events = await playedEvents(code, 0, 3)
    expect(events.map((e) => e.value['note'])).toEqual(['c3', 'd3', 'e3'])
  })

  it('writes probabilities after weights and chords', async () => {
    const notes = [note(0, 8, 'c3', { probability: 0.25 }), note(0, 8, 'e3', { probability: 0.25 })]
    const code = block(notesTrack(notes))
    expect(code).toBe('$: note("[c3,e3]?0.75 ~").s("sawtooth").orbit(2)')
    // Probability 0.25 is the chance to play: about 32 of 128 notes over 64 cycles.
    const events = await playedEvents(code, 0, 64)
    expect(events.length).toBeGreaterThan(10)
    expect(events.length).toBeLessThan(60)
  })

  it('combines a drop chance and a weight on the same note', async () => {
    const code = block(notesTrack([note(0, 3, 'c3', { probability: 0.5 }), note(3, 1, 'e3')]))
    expect(code).toBe('$: note("c3?0.5@3 e3 ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~").s("sawtooth").orbit(2)')
    const events = await playedEvents(code, 0, 16)
    expect(events.filter((e) => e.value['note'] === 'e3').map((e) => e.begin % 1)).toEqual(Array(16).fill(0.1875))
    expect(events.filter((e) => e.value['note'] === 'c3').every((e) => e.begin % 1 === 0)).toBe(true)
  })

  it('writes an aligned velocity pattern for one voice', async () => {
    const code = block(notesTrack([note(0, 4, 'c3', { velocity: 0.5 }), note(8, 8, 'e3')]))
    expect(code).toBe('$: note("c3 ~ e3@2").velocity("0.5 ~ 1@2").s("sawtooth").orbit(2)')
    const events = await playedEvents(code)
    expect(events.map((e) => [e.value['note'], e.value['velocity']])).toEqual([
      ['c3', 0.5],
      ['e3', 1],
    ])
  })

  it('splits chord members with different velocities and stacks voices', async () => {
    const code = block(notesTrack([note(0, 8, 'c3'), note(0, 8, 'e3', { velocity: 0.4 })]))
    expect(code).toBe('$: stack(note("c3 ~"), note("e3 ~").velocity("0.4 ~")).s("sawtooth").orbit(2)')
    const events = await playedEvents(code)
    expect(events.map((e) => [e.value['note'], e.value['velocity'] ?? null])).toEqual([
      ['c3', null],
      ['e3', 0.4],
    ])
  })

  it('uses n() and .scale() in degree mode', async () => {
    const track = notesTrack([note(0, 8, 0), note(8, 8, -1)], {
      notes: { mode: 'degree', scale: 'D:major', stepsPerCycle: 16, notes: [note(0, 8, 0), note(8, 8, -1)] },
    })
    const code = block(track)
    expect(code).toBe('$: n("0 -1").scale("D:major").s("sawtooth").orbit(2)')
    const events = await playedEvents(code)
    expect(events.map((e) => e.value['note'])).toEqual(['D3', 'C#3'])
  })
})

describe('free code tracks', () => {
  it('inserts the code verbatim, then mixer parameters and the orbit', () => {
    const track = codeTrack('  note("c3 e3")\n  .s("sine")  \n', { params: { gain: 0.5, pan: 0.2 } })
    expect(block(track)).toBe('$: note("c3 e3")\n  .s("sine").gain(0.5).pan(0.2).orbit(3)')
  })

  it('starts the suffix on a new line after a trailing comment', async () => {
    const code = block(codeTrack('s("bd") // kick'))
    expect(code).toBe('$: s("bd") // kick\n  .orbit(3)')
    expect(await playedEvents(code)).toEqual([{ begin: 0, value: { s: 'bd', orbit: 3 } }])
  })

  it('writes silence for empty code', () => {
    expect(block(codeTrack('   '))).toBe('$: silence.orbit(3)')
  })
})

describe('parameters', () => {
  it('follows the TrackParams order whatever the object order', () => {
    const params = { release: 0.2, vowel: 'o', lpf: 800, gain: 0.7, pan: 0.25, room: 0.3, begin: 0.1, end: 0.9 }
    expect(block(codeTrack('s("bd")', { params }))).toBe(
      '$: s("bd").gain(0.7).pan(0.25).lpf(800).room(0.3).vowel("o").release(0.2).begin(0.1).end(0.9).orbit(3)',
    )
  })

  it('skips values equal to the Strudel default', () => {
    expect(block(codeTrack('s("bd")', { params: { gain: 1, pan: 0.5 } }))).toBe('$: s("bd").orbit(3)')
  })

  it('rounds numbers to 3 decimals without trailing zeros', () => {
    const params = { gain: 0.123456, pan: 0.5, lpf: 1200.0, lpq: 0.1 + 0.2, hpf: -0.0001 }
    expect(block(codeTrack('s("bd")', { params }))).toBe('$: s("bd").gain(0.123).lpf(1200).lpq(0.3).hpf(0).orbit(3)')
  })

  it.each(SIGNAL_SHAPES)('writes a %s modulation', async (shape) => {
    const params = { gain: 1, pan: 0.5, lpf: { kind: 'signal' as const, shape, min: 300, max: 1200, cycles: 4 } }
    const code = block(codeTrack('s("bd*4")', { params }))
    expect(code).toBe(`$: s("bd*4").lpf(${shape}.range(300, 1200).slow(4)).orbit(3)`)
    const cutoffs = (await playedEvents(code, 0, 4)).map((e) => e.value['cutoff'] as number)
    expect(cutoffs.every((c) => c >= 300 && c <= 1200)).toBe(true)
  })

  it('omits .slow(1)', () => {
    const params = {
      gain: { kind: 'signal' as const, shape: 'sine' as const, min: 0.2, max: 0.8, cycles: 1 },
      pan: 0.5,
    }
    expect(block(codeTrack('s("bd")', { params }))).toBe('$: s("bd").gain(sine.range(0.2, 0.8)).orbit(3)')
  })

  it('writes a sequence modulation as a per-cycle pattern', async () => {
    const params = { gain: 1, pan: 0.5, lpf: { kind: 'sequence' as const, values: [200, 800, 1200, 400] } }
    const code = block(codeTrack('s("bd")', { params }))
    expect(code).toBe('$: s("bd").lpf("<200 800 1200 400>").orbit(3)')
    expect((await playedEvents(code, 0, 4)).map((e) => e.value['cutoff'])).toEqual([200, 800, 1200, 400])
  })
})

describe('transforms', () => {
  const expected: Record<(typeof TRANSFORM_TYPES)[number], string> = {
    fast: '.fast(2)',
    slow: '.slow(2)',
    rev: '.rev()',
    jux: '.jux(rev)',
    ply: '.ply(2)',
    degradeBy: '.degradeBy(0.3)',
    sometimes: '.sometimes(x => x.speed(2))',
    lastOf: '.lastOf(4, x => x.fast(2))',
    chop: '.chop(8)',
    striate: '.striate(4)',
    slice: '.slice(8, "0 2 1 3")',
    splice: '.splice(8, "0 1 2 3 4 5 6 7")',
    loopAt: '.loopAt(2)',
    custom: '',
  }

  it.each(TRANSFORM_TYPES)('writes %s with its default arguments, and Strudel accepts it', async (type) => {
    const transform = createTransform(type, () => 't')
    const code = block(codeTrack('s("bd sd")', { transforms: [transform] }))
    expect(code).toBe(`$: s("bd sd")${expected[type]}.orbit(3)`)
    await expect(playedEvents(code)).resolves.toBeDefined()
  })

  it('writes custom code, adding the leading dot', () => {
    const custom = (code: string) => ({ id: 'c', type: 'custom' as const, args: { code }, enabled: true })
    expect(block(codeTrack('s("bd")', { transforms: [custom('hurry(2)')] }))).toBe('$: s("bd").hurry(2).orbit(3)')
    expect(block(codeTrack('s("bd")', { transforms: [custom(' .late(0.1) ')] }))).toBe('$: s("bd").late(0.1).orbit(3)')
  })

  it('keeps list order, skips disabled transforms and uses edited arguments', () => {
    const transforms = [
      { id: 'a', type: 'fast' as const, args: { factor: 3 }, enabled: true },
      { id: 'b', type: 'rev' as const, args: {}, enabled: false },
      { id: 'c', type: 'degradeBy' as const, args: { amount: 'oops' }, enabled: true },
    ]
    expect(block(codeTrack('s("bd")', { transforms }))).toBe('$: s("bd").fast(3).degradeBy(0.3).orbit(3)')
  })

  it('places transforms after parameters and before the orbit', () => {
    const track = notesTrack([note(0, 16, 'c3')], {
      params: { gain: 0.5, pan: 0.5 },
      transforms: [createTransform('rev', () => 't')],
    })
    expect(block(track)).toBe('$: note("c3").s("sawtooth").gain(0.5).rev().orbit(2)')
  })
})

describe('code safety', () => {
  it('refuses to write a sound name that would escape the string', () => {
    const track = stepsTrack([{ ...stepRow('bd', [0]), sound: 'bd`).x(1)//' }])
    expect(() => block(track)).toThrow('Invalid sound name')
    const bank = stepsTrack([stepRow('bd', [0])], { source: { type: 'bank', bank: 'a"b' } })
    expect(() => block(bank)).toThrow('Invalid bank')
    expect(() => block(notesTrack([note(0, 1, 'c3") + x("')]))).toThrow('Invalid note name')
  })

  it('refuses non-finite numbers', () => {
    expect(() => block(codeTrack('s("bd")', { params: { gain: Number.NaN, pan: 0.5 } }))).toThrow()
  })

  it('writes HIT steps as plain tokens', () => {
    expect(HIT).toEqual({ velocity: 1, probability: 1 })
  })
})

describe('tracks missing their content', () => {
  it('fall back to silence-like patterns instead of throwing', () => {
    const { steps: _steps, ...stepsWithout } = stepsTrack([])
    const { notes: _notes, ...notesWithout } = notesTrack([])
    const { code: _code, ...codeWithout } = codeTrack('')
    expect(block(stepsWithout as Track)).toBe('$: s("~").bank("RolandTR909").orbit(1)')
    expect(block(notesWithout as Track)).toBe('$: note("~").s("sawtooth").orbit(2)')
    expect(block(codeWithout as Track)).toBe('$: silence.orbit(3)')
  })
})
