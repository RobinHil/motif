import { describe, expect, it } from 'vitest'
import { createDemoProject } from '../model/demo'
import { ProjectSchema, type ID } from '../model/project'
import * as actions from './actions'
import { createProjectStore, MAX_HISTORY, selectCanRedo, selectCanUndo, selectIsDirty } from './project-store'

function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function counterIds(prefix: string) {
  let n = 0
  return () => `${prefix}${String(n++)}`
}

describe('undo and redo', () => {
  it('returns to the initial project after 200 edits and 200 undos', () => {
    const store = createProjectStore(createDemoProject(new Date(0)))
    const initial = store.getState().project
    const random = seeded(42)
    const ids = counterIds('gen')
    const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T

    let edits = 0
    while (edits < 200) {
      const { project, update } = store.getState()
      const track = pick(project.tracks)
      const before = store.getState().project
      switch (Math.floor(random() * 8)) {
        case 0: {
          const row = track.steps?.rows[0]
          if (row) update(actions.toggleStep(track.id, row.id, Math.floor(random() * 16)))
          break
        }
        case 1:
          update(actions.setParam(track.id, 'lpf', Math.round(random() * 5000)))
          break
        case 2:
          update(actions.setMute(track.id, !track.mute))
          break
        case 3:
          update(actions.setBpm(60 + random() * 120))
          break
        case 4:
          if (project.tracks.length < 12)
            update(actions.addTrack(pick(['steps', 'notes', 'code'] as const), ids).recipe)
          break
        case 5:
          if (project.tracks.length > 1) update(actions.removeTrack(track.id))
          break
        case 6:
          update(actions.addTransform(track.id, pick(['fast', 'rev', 'jux'] as const), ids))
          break
        default:
          update(actions.renameTrack(track.id, `Track ${String(edits)}`))
      }
      if (store.getState().project !== before) {
        edits++
        expect(ProjectSchema.safeParse(store.getState().project).success).toBe(true)
      }
    }

    const edited = store.getState().project
    expect(edited).not.toEqual(initial)
    for (let i = 0; i < 200; i++) store.getState().undo()
    expect(store.getState().project).toEqual(initial)
    expect(store.getState().project).toBe(initial)
    expect(selectCanUndo(store.getState())).toBe(false)

    for (let i = 0; i < 200; i++) store.getState().redo()
    expect(store.getState().project).toBe(edited)
    expect(selectCanRedo(store.getState())).toBe(false)
  })

  it('records nothing for an edit that changes nothing', () => {
    const store = createProjectStore(createDemoProject())
    store.getState().update(actions.setMute('missing-track', true))
    store.getState().update(actions.setMute('demo-drums', false))
    expect(store.getState().past).toHaveLength(0)
  })

  it('clears the redo stack on a new edit', () => {
    const store = createProjectStore(createDemoProject())
    const { update } = store.getState()
    update(actions.setBpm(100))
    store.getState().undo()
    expect(selectCanRedo(store.getState())).toBe(true)
    store.getState().update(actions.setBpm(90))
    expect(selectCanRedo(store.getState())).toBe(false)
  })

  it('keeps at most MAX_HISTORY steps', () => {
    const store = createProjectStore(createDemoProject())
    for (let i = 0; i < MAX_HISTORY + 20; i++) store.getState().update(actions.setBpm(60 + (i % 300)))
    expect(store.getState().past).toHaveLength(MAX_HISTORY)
  })
})

describe('continuous gestures', () => {
  it('turn a whole drag into one undo step', () => {
    const store = createProjectStore(createDemoProject())
    const initial = store.getState().project
    store.getState().beginGesture()
    for (let i = 0; i <= 50; i++) store.getState().update(actions.setParam('demo-bass', 'lpf', 200 + i * 20))
    expect(store.getState().past).toHaveLength(0)
    expect(selectCanUndo(store.getState())).toBe(true)
    store.getState().endGesture()

    expect(store.getState().past).toHaveLength(1)
    expect(store.getState().project.tracks[1]?.params.lpf).toBe(1200)
    store.getState().undo()
    expect(store.getState().project).toBe(initial)
  })

  it('record nothing when the gesture changed nothing', () => {
    const store = createProjectStore(createDemoProject())
    store.getState().beginGesture()
    store.getState().beginGesture()
    store.getState().endGesture()
    store.getState().endGesture()
    expect(store.getState().past).toHaveLength(0)
  })

  it('end the gesture when undo is pressed during it', () => {
    const store = createProjectStore(createDemoProject())
    const initial = store.getState().project
    store.getState().beginGesture()
    store.getState().update(actions.setBpm(80))
    store.getState().undo()
    expect(store.getState().project).toBe(initial)
    expect(store.getState().gestureBase).toBeNull()
    store.getState().redo()
    expect(store.getState().project.transport.bpm).toBe(80)
  })
})

describe('load and save state', () => {
  it('clears the history on load and tracks unsaved changes', () => {
    const store = createProjectStore(createDemoProject())
    expect(selectIsDirty(store.getState())).toBe(false)
    store.getState().update(actions.setBpm(100))
    const loaded = createDemoProject()
    store.getState().load(loaded, { saved: true })
    expect(store.getState().past).toHaveLength(0)
    expect(selectIsDirty(store.getState())).toBe(false)
    store.getState().update(actions.setBpm(101))
    expect(selectIsDirty(store.getState())).toBe(true)
    store.getState().markSaved()
    expect(selectIsDirty(store.getState())).toBe(false)
    store.getState().load(createDemoProject())
    expect(selectIsDirty(store.getState())).toBe(true)
  })
})

describe('amend', () => {
  it('changes the project without an undo step and keeps it clean', () => {
    const store = createProjectStore(createDemoProject())
    store.getState().markSaved()
    store.getState().amend((p) => {
      p.meta.updatedAt = 'later'
    })
    expect(store.getState().project.meta.updatedAt).toBe('later')
    expect(store.getState().past).toHaveLength(0)
    expect(selectIsDirty(store.getState())).toBe(false)
  })
})

describe('actions', () => {
  const setup = () => {
    const store = createProjectStore(createDemoProject(new Date(0)))
    const apply = (recipe: Parameters<ReturnType<typeof store.getState>['update']>[0]) => {
      store.getState().update(recipe)
      return store.getState().project
    }
    const track = (id: ID) => store.getState().project.tracks.find((t) => t.id === id)
    return { store, apply, track }
  }

  it('add, duplicate, move and remove tracks', () => {
    const { apply, track } = setup()
    const ids = counterIds('x')
    const added = actions.addTrack('notes', ids)
    apply(added.recipe)
    expect(track(added.id)).toMatchObject({ kind: 'notes', orbit: 5, color: 'track-1' })

    const copy = actions.duplicateTrack('demo-drums', ids)
    let project = apply(copy.recipe)
    expect(project.tracks[1]?.id).toBe(copy.id)
    expect(track(copy.id)).toMatchObject({ name: 'Drums copy', orbit: 6 })
    expect(track(copy.id)?.steps?.rows.map((r) => r.id)).not.toEqual(track('demo-drums')?.steps?.rows.map((r) => r.id))
    expect(ProjectSchema.safeParse(project).success).toBe(true)

    project = apply(actions.moveTrack(copy.id, 99))
    expect(project.tracks.at(-1)?.id).toBe(copy.id)
    apply(actions.moveTrack('missing', 0))

    const count = apply(actions.removeTrack(copy.id)).tracks.length
    expect(track(copy.id)).toBeUndefined()
    expect(apply(actions.duplicateTrack('missing', ids).recipe).tracks).toHaveLength(count)
  })

  it('removing a track also removes its scene membership, automations and MIDI mappings', () => {
    const { store, apply } = setup()
    store.getState().load({
      ...store.getState().project,
      scenes: [{ id: 's', name: 'A', lengthCycles: 4, activeTrackIds: ['demo-bass', 'demo-lead'] }],
      automations: [{ id: 'a', target: { trackId: 'demo-bass', param: 'lpf' }, points: [] }],
      midiMappings: [{ deviceName: 'X', channel: 1, cc: 7, target: { trackId: 'demo-bass', param: 'gain' } }],
    })
    const project = apply(actions.removeTrack('demo-bass'))
    expect(project.scenes[0]?.activeTrackIds).toEqual(['demo-lead'])
    expect(project.automations).toEqual([])
    expect(project.midiMappings).toEqual([])
  })

  it('edit track properties', () => {
    const { apply, track } = setup()
    apply(actions.renameTrack('demo-bass', '  Sub  '))
    apply(actions.renameTrack('demo-lead', '   '))
    apply(actions.setTrackColor('demo-bass', 'track-4'))
    apply(actions.setSolo('demo-bass', true))
    apply(actions.setSource('demo-bass', { type: 'synth', name: 'square' }))
    apply(actions.setCode('demo-texture', 's("bd")'))
    apply(actions.setCode('demo-bass', 'ignored'))
    expect(track('demo-bass')).toMatchObject({ name: 'Sub', color: 'track-4', solo: true, source: { name: 'square' } })
    expect(track('demo-bass')?.code).toBeUndefined()
    expect(track('demo-lead')?.name).toBe('Lead')
    expect(track('demo-texture')?.code).toBe('s("bd")')
  })

  it('set and remove parameters, keeping gain and pan', () => {
    const { apply, track } = setup()
    apply(actions.setParam('demo-bass', 'room', { kind: 'sequence', values: [0.1, 0.5] }))
    apply(actions.setParam('demo-bass', 'lpf', undefined))
    apply(actions.setParam('demo-bass', 'gain', undefined))
    apply(actions.setParam('demo-bass', 'vowel', 'a'))
    expect(track('demo-bass')?.params).toEqual({
      gain: 0.9,
      pan: 0.5,
      lpq: 4,
      room: { kind: 'sequence', values: [0.1, 0.5] },
      vowel: 'a',
    })
  })

  it('clamps the tempo', () => {
    const { apply } = setup()
    expect(apply(actions.setBpm(1000)).transport.bpm).toBe(400)
    expect(apply(actions.setBpm(97.46)).transport.bpm).toBe(97.5)
  })

  it('edit steps and rows', () => {
    const { apply, track } = setup()
    apply(actions.toggleStep('demo-drums', 'demo-drums-bd', 1))
    apply(actions.toggleStep('demo-drums', 'demo-drums-bd', 0))
    apply(actions.toggleStep('demo-drums', 'demo-drums-bd', 99))
    apply(actions.setStep('demo-drums', 'demo-drums-sd', 5, { velocity: 2, probability: -1 }))
    apply(actions.setStep('demo-drums', 'demo-drums-sd', 4, null))
    apply(actions.setStep('demo-drums', 'nope', 4, null))
    apply(actions.addRow('demo-drums', 'rim', () => 'rim-row'))
    apply(actions.removeRow('demo-drums', 'demo-drums-hh'))
    const rows = track('demo-drums')?.steps?.rows ?? []
    expect(rows[0]?.steps.slice(0, 2)).toEqual([null, { velocity: 1, probability: 1 }])
    expect(rows[1]?.steps[4]).toBeNull()
    expect(rows[1]?.steps[5]).toEqual({ velocity: 1, probability: 0 })
    expect(rows.map((r) => r.id)).toEqual(['demo-drums-bd', 'demo-drums-sd', 'rim-row'])
  })

  it('edit notes', () => {
    const { apply, track } = setup()
    apply(actions.addNote('demo-bass', { step: 4, length: 1, pitch: 'f2', velocity: 1, probability: 1 }, () => 'new'))
    apply(actions.updateNote('demo-bass', 'new', { pitch: 'g2', velocity: 0.5 }))
    apply(actions.removeNote('demo-bass', 'demo-bass-1'))
    const notes = track('demo-bass')?.notes?.notes ?? []
    expect(notes.find((n) => n.id === 'new')).toMatchObject({ pitch: 'g2', velocity: 0.5 })
    expect(notes.some((n) => n.id === 'demo-bass-1')).toBe(false)
  })

  it('edit transforms', () => {
    const { apply, track } = setup()
    apply(actions.addTransform('demo-bass', 'fast', () => 'f'))
    apply(actions.setTransformArg('demo-bass', 'f', 'factor', 4))
    apply(actions.setTransformEnabled('demo-bass', 'f', false))
    expect(track('demo-bass')?.transforms).toEqual([{ id: 'f', type: 'fast', args: { factor: 4 }, enabled: false }])
    apply(actions.removeTransform('demo-bass', 'f'))
    expect(track('demo-bass')?.transforms).toEqual([])
  })
})
