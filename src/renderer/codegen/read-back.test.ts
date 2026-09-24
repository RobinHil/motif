import { describe, expect, it } from 'vitest'
import { createDemoProject } from '../model/demo'
import { createTransform } from '../model/defaults'
import { ProjectSchema, SIGNAL_SHAPES, TRANSFORM_TYPES, type Project, type Track } from '../model/project'
import { generateProjectCode, generateTrackCode } from './generate'
import { parseTrackBlock } from './parse'
import { readBack, resolvePending, sameCode, splitProgram } from './read-back'
import { note, notesTrack, stepRow, stepsTrack } from './test-fixtures'

const ids = () => {
  let n = 0
  return () => `new-${String(n++)}`
}

function roundTrip(track: Track): void {
  const code = generateTrackCode(track, false)
  const parsed = parseTrackBlock(code, track, ids())
  if (!parsed.ok) throw new Error(`${parsed.reason}\n${code}`)
  expect(generateTrackCode(parsed.track, false)).toBe(code)
  // Notes may come back in another order (voice by voice): compare them as a set.
  const byId = (t: Track) => ({
    ...t,
    notes: t.notes && { ...t.notes, notes: [...t.notes.notes].sort((a, b) => a.id.localeCompare(b.id)) },
  })
  expect(byId(parsed.track)).toEqual(byId(track))
}

const demo = () => createDemoProject(new Date(0))
const edit = (project: Project, replace: [string, string][]) => {
  let code = generateProjectCode(project).code
  for (const [from, to] of replace) {
    expect(code, `"${from}" should be in the code`).toContain(from)
    code = code.replace(from, to)
  }
  return code
}

describe('parseTrackBlock round trips', () => {
  it('reads back every structured demo track', () => {
    for (const track of demo().tracks.filter((t) => t.kind !== 'code')) roundTrip(track)
  })

  it('reads back steps with variants, drop chances, velocities and empty rows', () => {
    const soft = { velocity: 0.5, probability: 0.75 }
    const hats = stepRow('hh', [0, 2, 4])
    hats.steps[2] = soft
    roundTrip(stepsTrack([stepRow('bd', [0, 8], { velocity: 1, probability: 0.3 }, 2), stepRow('sd', []), hats]))
    roundTrip(stepsTrack([]))
    roundTrip(stepsTrack([stepRow('rim', [3])], { source: { type: 'bank', bank: 'OtherKit' } }))
  })

  it('reads back notes: long notes, chords, alternatives, layers, velocities, degrees', () => {
    roundTrip(notesTrack([note(0, 3, 'c3'), note(3, 1, 'e3'), note(8, 8, 'g3', { alternatives: ['a3', 'b3'] })]))
    roundTrip(
      notesTrack([note(0, 8, 'c3'), note(0, 8, 'eb3'), note(0, 8, 'g3', { alternatives: ['f3'] }), note(8, 8, 'f3')]),
    )
    roundTrip(notesTrack([note(0, 8, 'c3'), note(4, 4, 'e3'), note(0, 4, 'c4', { probability: 0.25 })]))
    roundTrip(notesTrack([note(0, 8, 'c3'), note(4, 8, 'e3', { velocity: 0.5 }), note(8, 8, 'g3')]))
    roundTrip(notesTrack([note(0, 4, 'c3', { velocity: 0.5 }), note(8, 8, 'e3')]))
    roundTrip(notesTrack([], {}))
    roundTrip(
      notesTrack([note(0, 8, 0), note(8, 8, -3)], {
        notes: { mode: 'degree', scale: 'D:major', stepsPerCycle: 16, notes: [note(0, 8, 0), note(8, 8, -3)] },
      }),
    )
  })

  it('reads back every parameter kind and every transform', () => {
    const transforms = TRANSFORM_TYPES.filter((t) => t !== 'custom').map((type) =>
      createTransform(type, () => `t-${type}`),
    )
    transforms.push({ id: 't-custom', type: 'custom', args: { code: '.hurry(2)' }, enabled: true })
    SIGNAL_SHAPES.forEach((shape, i) => {
      roundTrip(
        notesTrack([note(0, 16, 'c3')], {
          params: {
            gain: 0.7,
            pan: 0.2,
            lpf: { kind: 'signal', shape, min: 200, max: 900, cycles: i + 1 },
            room: { kind: 'sequence', values: [0, 0.5] },
            vowel: 'a',
            speed: -1,
          },
          transforms,
        }),
      )
    })
  })

  it('refuses code it cannot represent', () => {
    const track = demo().tracks[0] as Track
    for (const text of [
      '$: s("bd*4").orbit(1)',
      '$: s(`bd`).orbit(1)',
      's(`bd`)',
      '$: s(`bd ~`).bank("x")',
      '$: s(`bd sd ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~ `).orbit(1)',
    ]) {
      expect(parseTrackBlock(text, track).ok, text).toBe(false)
    }
    expect(parseTrackBlock('$: note("c3 ~ ~").orbit(2)', demo().tracks[1] as Track).ok).toBe(false)
  })
})

describe('splitProgram', () => {
  it('attaches comments right above a block to that block', () => {
    const { header, blocks } = splitProgram(
      'setcpm(120/4)\n\n// Drums\n$: s("bd").orbit(1)\n  .gain(1)\n\n// orphan\n\n$: s("sd").orbit(2)\n',
    )
    expect(header).toEqual(['setcpm(120/4)', ''])
    expect(blocks.map((b) => [b.line, b.orbit])).toEqual([
      [3, 1],
      [9, 2],
    ])
    expect(blocks[0]?.text).toBe('// Drums\n$: s("bd").orbit(1)\n  .gain(1)\n\n// orphan')
  })
})

describe('readBack', () => {
  it('changes nothing when the code is the generated code, however it is spaced', () => {
    const project = demo()
    const code = generateProjectCode(project).code
    expect(readBack(code, project)).toEqual({ project, pending: [], errors: [] })
    const respaced = code.replace('bd ~  ~  ~', 'bd ~ ~   ~').replace('.orbit(2)', ' .orbit( 2 )')
    expect(readBack(respaced, project).project.tracks).toEqual(project.tracks)
  })

  it('updates the grid when a step is typed in the canonical format', () => {
    const project = demo()
    const code = edit(project, [['$: s(`bd ~  ~  ~', '$: s(`bd bd ~  ~']])
    const result = readBack(code, project, ids())
    expect(result.pending).toEqual([])
    const rows = result.project.tracks[0]?.steps?.rows ?? []
    expect(rows[0]?.steps[1]).toEqual({ velocity: 1, probability: 1 })
    expect(rows[0]?.id).toBe('demo-drums-bd')
    expect(generateProjectCode(result.project).code).toContain('$: s(`bd bd ~  ~')
  })

  it('reads parameters, transforms, sounds, scales, tempo and mute back into the model', () => {
    const project = demo()
    const code = edit(project, [
      ['setcpm(120/4)', 'setcpm(96/3)'],
      ['.room(0.4).jux(rev)', '.room(0.8).jux(rev).fast(2)'],
      ['.scale("C:minor")', '.scale("D:dorian")'],
      ['.s("sawtooth")', '.s("square")'],
      ['$: note("c2', '_$: note("c2'],
    ])
    const result = readBack(code, project, ids())
    expect(result.pending).toEqual([])
    const [, bass, lead] = result.project.tracks
    expect(result.project.transport).toEqual({ bpm: 96, beatsPerCycle: 3 })
    expect(bass).toMatchObject({ mute: true, source: { type: 'synth', name: 'square' } })
    expect(lead?.params.room).toBe(0.8)
    expect(lead?.notes?.scale).toBe('D:dorian')
    expect(lead?.transforms.map((t) => [t.id, t.type])).toEqual([
      ['demo-lead-jux', 'jux'],
      ['new-0', 'fast'],
    ])
    expect(ProjectSchema.safeParse(result.project).success).toBe(true)
  })

  it('offers conversion for code the grid cannot show, and never loses the typed text', () => {
    const project = demo()
    const typed =
      '$: n("0 2 4 <5 7> ~ 4 2 ~").scale("C:minor").s("triangle").room(0.4).jux(rev).sometimes(x => x.fast(3)).orbit(3)'
    const code = edit(project, [
      ['$: n("0 2 4 <5 7> ~ 4 2 ~").scale("C:minor").s("triangle").room(0.4).jux(rev).orbit(3)', typed],
    ])
    const result = readBack(code, project, ids())
    expect(result.pending.map((p) => [p.trackId, p.text])).toEqual([['demo-lead', typed]])
    // Until the user decides, the track is unchanged.
    expect(result.project.tracks[2]).toEqual(project.tracks[2])

    const converted = resolvePending(result.project, result.pending, 'convert')
    const lead = converted.tracks[2]
    expect(lead).toMatchObject({ kind: 'code', params: { gain: 1, pan: 0.5 }, transforms: [] })
    expect(generateTrackCode(lead as Track, false)).toBe(typed)
    expect(ProjectSchema.safeParse(converted).success).toBe(true)

    expect(resolvePending(result.project, result.pending, 'undo')).toBe(result.project)
  })

  it('keeps leading comments when converting', () => {
    const project = demo()
    const code = edit(project, [['$: s(`bd', '// Drums\n$: s(`bd']])
    const result = readBack(code, project)
    const drums = resolvePending(result.project, result.pending, 'convert').tracks[0] as Track
    const regenerated = generateTrackCode(drums, false)
    expect(regenerated.startsWith('$: // Drums\ns(`bd')).toBe(true)
    expect(sameCode(regenerated.replace('$: // Drums\n', '// Drums\n$: '), result.pending[0]?.text ?? '')).toBe(true)
  })

  it('updates free code, keeping the mixer suffix when it is untouched', () => {
    const project = demo()
    project.tracks[3] = { ...(project.tracks[3] as Track), params: { gain: 0.5, pan: 0.5 } }
    const kept = readBack(edit(project, [['s("wind*2")', 's("wind*4")']]), project)
    expect(kept.project.tracks[3]).toMatchObject({
      code: 's("wind*4").speed(perlin.range(0.5, 1.5)).chop(8).degradeBy(0.3)',
      params: { gain: 0.5 },
    })

    const typedMixer = readBack(edit(project, [['.gain(0.5).orbit(4)', '.gain(0.7).orbit(4)']]), project)
    expect(typedMixer.project.tracks[3]).toMatchObject({ params: { gain: 1, pan: 0.5 } })
    expect((typedMixer.project.tracks[3] as Track).code).toContain('.gain(0.7)')
  })

  it('adds a free code track for a new block and removes the tracks whose block was deleted', () => {
    const project = demo()
    const code = `${generateProjectCode(project).code.replace(/\$: s\("wind[^\n]*\n/, '')}$: s("cp*2")\n`
    const result = readBack(code, project, ids())
    expect(result.project.tracks.map((t) => t.name)).toEqual(['Drums', 'Bass', 'Lead', 'Free code 4'])
    expect(result.project.tracks[3]).toMatchObject({ kind: 'code', code: 's("cp*2")', orbit: 4 })
  })

  it('refuses stray code above the first track and duplicated orbits', () => {
    const project = demo()
    expect(readBack(edit(project, [['setcpm(120/4)', 'setcpm(120/4)\nhush()']]), project).errors[0]).toContain('hush()')
    const duplicated = edit(project, [['.orbit(2)', '.orbit(1)']])
    const result = readBack(duplicated, project)
    expect(result.errors[0]).toContain('orbit(1)')
    expect(result.project).toBe(project)
  })
})

describe('parseTrackBlock refusals', () => {
  const drums = () => demo().tracks[0] as Track
  const bass = () => demo().tracks[1] as Track
  const lead = () => demo().tracks[2] as Track
  const row = (text: string) => `$: s(\`${text}\`).bank("MotifKit").orbit(1)`
  const empty = '~  '.repeat(16).trim()

  it.each([
    [row(`bd ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  bd:2`), 'A row plays a single sound'],
    [row(`b@d ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~`), 'Unexpected step'],
    [
      `$: stack(s(\`bd ${'~ '.repeat(15)}\`).velocity(\`1 ~\`)).bank("MotifKit").orbit(1)`,
      'Velocities do not line up with the steps',
    ],
    [`$: stack(s(\`bd ${'~ '.repeat(15)}\`).fast(2)).bank("MotifKit").orbit(1)`, 'Unexpected call in a row'],
    [
      `$: stack(s(\`bd ${'~ '.repeat(15)}\`).velocity(\`x ${'~ '.repeat(15)}\`)).bank("MotifKit").orbit(1)`,
      'Unexpected velocity',
    ],
    ['$: s(`${x}`).orbit(1)', 'Expected a string'],
    ['$: s(`bd`).bank("MotifKit")', 'A track ends with .orbit(n)'],
    ['$: s(`bd`).orbit(1); hush()', 'Unexpected code after the pattern'],
    ['s(`bd`)', 'A track starts with $:'],
    [row(empty).replace('MotifKit', 'Bad Kit'), 'Unexpected sound name'],
  ])('refuses %s', (text, reason) => {
    const result = parseTrackBlock(text, drums())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain(reason)
  })

  it.each([
    ['$: note("c2 c2 c2").s("sawtooth").orbit(2)', 'The notes do not fit the 16-step grid'],
    ['$: note("c2 x9").s("sawtooth").orbit(2)', 'Unexpected note'],
    ['$: note("c2 c2, e2 e2").velocity("1 1").s("sawtooth").orbit(2)', 'Velocities of several voices need stack()'],
    ['$: note("c2 c2").velocity("1").s("sawtooth").orbit(2)', 'Velocities do not line up with the notes'],
    ['$: note("c2 c2").velocity("x 1").s("sawtooth").orbit(2)', 'Unexpected velocity'],
    ['$: stack(note("c2 c2").fast(2)).s("sawtooth").orbit(2)', 'Unexpected call in a voice'],
    ['$: note("c2 c2").s("saw tooth").orbit(2)', 'Unexpected sound name'],
    ['$: note("c2 c2").s("sawtooth").vowel("xyz").orbit(2)', 'Unexpected vowel'],
    ['$: note("c2 c2").s("sawtooth").lpf("<1 x>").orbit(2)', 'Unexpected sequence value'],
    ['$: note("c2 c2").s("sawtooth").lpf("c2").orbit(2)', 'Unexpected pattern value'],
    ['$: note("c2 c2").s("sawtooth").lpf(sine.fast(2)).orbit(2)', 'Unexpected parameter value'],
    ['$: note("c2 c2").s("sawtooth").lpf(sine.range(1, 2).fast(2)).orbit(2)', 'Unexpected signal'],
    ['$: note("c2 c2").s("sawtooth").lpf("x" + 1).orbit(2)', 'Unexpected parameter value'],
    ['$: note("c2 c2").s("sawtooth").sometimes(rev).orbit(2)', 'Expected x => x.speed'],
    ['$: note("c2 c2").s("sawtooth").sometimes(x => x.fast(2)).orbit(2)', 'Unexpected function'],
    ['$: note("c2 c2").s("sawtooth").fast("2").orbit(2)', 'Expected a number'],
    ['$: note("c2 c2").s("sawtooth")["fast"](2).orbit(2)', 'Unexpected call'],
  ])('refuses %s', (text, reason) => {
    const result = parseTrackBlock(text, bass())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain(reason)
  })

  it.each([
    ['$: n("0 x").scale("C:minor").s("triangle").orbit(3)', 'Unexpected degree'],
    ['$: n("0 2").s("triangle").orbit(3)', 'Degree mode needs .scale()'],
    ['$: n("0 2").scale("C minor").s("triangle").orbit(3)', 'Unexpected scale'],
    ['$: note("0 2").scale("C:minor").s("triangle").orbit(3)', 'Expected n or stack(...)'],
  ])('refuses %s', (text, reason) => {
    const result = parseTrackBlock(text, lead())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain(reason)
  })

  it('refuses free code tracks and reports syntax errors', () => {
    const texture = demo().tracks[3] as Track
    const result = parseTrackBlock('$: s("wind").orbit(4)', texture)
    expect(result).toEqual({ ok: false, reason: 'Only rhythm and note tracks can be read back' })
    expect(parseTrackBlock('$: s(`bd`.orbit(1)', drums()).ok).toBe(false)
  })

  it('keeps the sound and variant of a row that became empty', () => {
    const track = stepsTrack([stepRow('bd', [0], undefined, 2)])
    const result = parseTrackBlock(`$: s(\`${empty}\`).bank("RolandTR909").orbit(1)`, track)
    expect(result.ok && result.track.steps?.rows[0]).toMatchObject({
      sound: 'bd',
      variant: 2,
      steps: Array(16).fill(null),
    })
    expect(parseTrackBlock(`$: s(\`${empty}\`).bank("RolandTR909").orbit(1)`, stepsTrack([])).ok).toBe(false)
  })
})

describe('readBack side effects', () => {
  it('drops the scene membership, automations and MIDI mappings of a removed track', () => {
    const project: Project = {
      ...demo(),
      scenes: [{ id: 's', name: 'A', lengthCycles: 4, activeTrackIds: ['demo-bass', 'demo-texture'] }],
      automations: [
        { id: 'a', target: { trackId: 'demo-texture', param: 'gain' }, points: [] },
        { id: 'm', target: { trackId: 'master', param: 'gain' }, points: [] },
      ],
      midiMappings: [{ deviceName: 'X', channel: 1, cc: 1, target: { trackId: 'demo-texture', param: 'gain' } }],
    }
    const code = generateProjectCode(project).code.replace(/\$: s\("wind[^\n]*\n/, '')
    const result = readBack(code, project)
    expect(result.project.scenes[0]?.activeTrackIds).toEqual(['demo-bass'])
    expect(result.project.automations.map((a) => a.id)).toEqual(['m'])
    expect(result.project.midiMappings).toEqual([])
  })

  it('keeps a track silenced by another track solo, whatever its prefix says', () => {
    const project = demo()
    project.tracks[0] = { ...(project.tracks[0] as Track), solo: true }
    const code = generateProjectCode(project).code.replace(
      '_$: note("c2 c2 eb2 g1").s("sawtooth").lpf(sine.range(300, 1200).slow(4)).orbit(2)',
      '$: note("c2 c2 eb2 g1").s("sawtooth").lpf(sine.range(300, 1200).slow(4)).room(0.2).orbit(2)',
    )
    const result = readBack(code, project)
    expect(result.pending).toEqual([])
    expect(result.project.tracks[1]).toMatchObject({ mute: false, params: { room: 0.2 } })
  })
})

describe('bypassed effects', () => {
  it('keeps the value of a bypassed effect when the code is read back', () => {
    const project = demo()
    project.tracks[2] = { ...(project.tracks[2] as Track), bypassed: ['room'] }
    const code = generateProjectCode(project).code
    expect(code).not.toContain('.room(0.4)')
    const result = readBack(code.replace('.jux(rev).orbit(3)', '.jux(rev).fast(2).orbit(3)'), project)
    expect(result.pending).toEqual([])
    expect(result.project.tracks[2]).toMatchObject({ bypassed: ['room'], params: { room: 0.4 } })
  })
})
