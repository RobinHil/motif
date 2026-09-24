import { describe, expect, it } from 'vitest'
import { createDemoProject } from '../model/demo'
import {
  addAutomation,
  addSection,
  captureScene,
  deleteScene,
  moveSection,
  movePoint,
  removePoint,
  resizeSection,
  setPoint,
  setSceneLength,
  toggleSceneTrack,
} from './arrangement-actions'
import { createProjectStore } from './project-store'

function setup() {
  const store = createProjectStore(createDemoProject(new Date(0)))
  let n = 0
  const ids = () => `id${String(n++)}`
  const sections = () =>
    store.getState().project.arrangement.map((b) => [b.sceneId.replace('demo-scene-', ''), b.startCycle])
  return { store, ids, sections, update: store.getState().update }
}

describe('arrangement actions', () => {
  it('captures the tracks that are heard', () => {
    const { store, ids, update } = setup()
    update((p) => {
      const lead = p.tracks.find((t) => t.name === 'Lead')
      if (lead) lead.mute = true
    })
    const { id, recipe } = captureScene(ids)
    update(recipe)
    const scene = store.getState().project.scenes.find((s) => s.id === id)
    expect(scene).toEqual({
      id,
      name: 'Scene 6',
      lengthCycles: 8,
      activeTrackIds: ['demo-drums', 'demo-bass', 'demo-texture'],
    })
    expect(store.getState().past.length).toBeGreaterThan(0)
  })

  it('moves a section and pushes the later ones instead of overlapping', () => {
    const { update, sections } = setup()
    update(moveSection('demo-section-5', 0))
    expect(sections()).toEqual([
      ['outro', 0],
      ['intro', 8],
      ['verse', 16],
      ['chorus', 32],
      ['drop', 40],
    ])
  })

  it('swaps neighbors one step at a time', () => {
    const { update, sections } = setup()
    update(moveSection('demo-section-5', 47))
    expect(sections().slice(3)).toEqual([
      ['outro', 32],
      ['drop', 40],
    ])
    update(moveSection('demo-section-1', 1))
    expect(sections().slice(0, 2)).toEqual([
      ['verse', 0],
      ['intro', 16],
    ])
  })

  it('adds sections at the end or at a cycle, and resizes one section only', () => {
    const { store, update, sections, ids } = setup()
    update(addSection('demo-scene-chorus', undefined, ids))
    expect(sections().at(-1)).toEqual(['chorus', 56])
    update(resizeSection('demo-section-1', 4))
    expect(sections().slice(0, 2)).toEqual([
      ['intro', 0],
      ['verse', 8],
    ])
    update(resizeSection('demo-section-1', 12))
    expect(sections().slice(0, 3)).toEqual([
      ['intro', 0],
      ['verse', 12],
      ['chorus', 28],
    ])
    expect(store.getState().project.scenes[0]?.lengthCycles).toBe(8)
    update(resizeSection('demo-section-1', 8))
    expect(store.getState().project.arrangement[0]?.lengthCycles).toBeUndefined()
  })

  it('edits scenes, and deleting one removes its sections', () => {
    const { store, update, sections } = setup()
    update(toggleSceneTrack('demo-scene-outro', 'demo-drums'))
    update(toggleSceneTrack('demo-scene-intro', 'demo-lead'))
    const scenes = store.getState().project.scenes
    expect(scenes.find((s) => s.name === 'Outro')?.activeTrackIds).toEqual(['demo-drums', 'demo-texture'])
    expect(scenes.find((s) => s.name === 'Intro')?.activeTrackIds).toEqual(['demo-texture'])
    update(setSceneLength('demo-scene-intro', 16))
    expect(sections()[1]).toEqual(['verse', 16])
    update(deleteScene('demo-scene-verse'))
    expect(sections().map(([name]) => name)).toEqual(['intro', 'chorus', 'drop', 'outro'])
  })

  it('edits automation points', () => {
    const { store, update, ids } = setup()
    const { id, recipe } = addAutomation({ trackId: 'demo-bass', param: 'room' }, 0.2, 56, ids)
    update(recipe)
    update(setPoint(id, 20.4, 0.8))
    const points = () => store.getState().project.automations.find((a) => a.id === id)?.points
    expect(points()).toEqual([
      { cycle: 0, value: 0.2 },
      { cycle: 20, value: 0.8 },
      { cycle: 56, value: 0.2 },
    ])
    update(movePoint(id, 1, 70, 0.5))
    expect(points()?.[1]).toEqual({ cycle: 56, value: 0.5 })
    update(removePoint(id, 1))
    update(removePoint(id, 0))
    update(removePoint(id, 0))
    expect(points()).toHaveLength(1)
  })
})
