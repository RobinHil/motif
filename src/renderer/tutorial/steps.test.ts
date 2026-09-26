import { describe, expect, it } from 'vitest'
import { generateSongCode } from '../codegen/song'
import { addNote, addTrack, dropOnTrack, setBpm, setParam, setStep } from '../store/actions'
import { createProjectStore } from '../store/project-store'
import { TUTORIAL_STEPS } from './steps'
import { createTutorialStart, createTutorialTrack } from './tracks'

const fresh = () => createProjectStore(createTutorialStart(new Date(0)))

describe('tutorial steps', () => {
  it('starts with nothing done', () => {
    const { project } = fresh().getState()
    expect(TUTORIAL_STEPS.filter((s) => s.done(project)).map((s) => s.id)).toEqual([])
  })

  it('does each step for the user without doing the next one', () => {
    const store = fresh()
    TUTORIAL_STEPS.forEach((step, i) => {
      const next = TUTORIAL_STEPS[i + 1]
      store.getState().update(step.apply)
      expect(step.done(store.getState().project), step.id).toBe(true)
      if (next) expect(next.done(store.getState().project), `${step.id} -> ${next.id}`).toBe(false)
    })
  })

  it('ends on the finished tutorial track', () => {
    const store = fresh()
    for (const step of TUTORIAL_STEPS) store.getState().update(step.apply)
    const built = store.getState().project
    const finished = createTutorialTrack(new Date(0))
    expect(generateSongCode(built).code).toBe(generateSongCode(finished).code)
    expect(built.tracks).toEqual(finished.tracks)
  })

  it('recognizes the work done by hand, whatever the names', () => {
    const store = fresh()
    const { update } = store.getState()
    update(setBpm(150))
    const kick = addTrack('steps', () => 'my-kick')
    update(kick.recipe)
    update(dropOnTrack('my-kick', { kind: 'sound', name: 'tek', category: 'Drums' }, () => 'my-row'))
    for (const i of [0, 4, 8, 12]) update(setStep('my-kick', 'my-row', i, { velocity: 1, probability: 1 }))
    const done = (id: string) => TUTORIAL_STEPS.find((s) => s.id === id)?.done(store.getState().project)
    expect(done('tempo')).toBe(true)
    expect(done('kick')).toBe(true)
    expect(done('saturation')).toBe(false)
    update(setParam('my-kick', 'shape', 0.25))
    expect(done('saturation')).toBe(true)

    const acid = addTrack('notes', () => 'my-acid')
    update(acid.recipe)
    update(setParam('my-acid', 'lpq', 20))
    for (let step = 0; step < 8; step++)
      update(
        addNote('my-acid', { step, length: 1, pitch: 'f2', velocity: 1, probability: 1 }, () => `n${String(step)}`),
      )
    expect(done('acid')).toBe(true)
    expect(done('animate')).toBe(false)
    update(setParam('my-acid', 'lpf', { kind: 'signal', shape: 'saw', min: 200, max: 3000, cycles: 4 }))
    expect(done('animate')).toBe(true)
  })
})
