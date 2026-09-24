// Sample editor edits (SPEC 7, "Sample editor"): region, slices and fit to tempo. Recipes for
// ProjectState.update, so they are undoable.
import { newId, type IdFactory } from '../model/defaults'
import type { ID } from '../model/project'
import type { Recipe } from './project-store'

export type SliceMode = 'slice' | 'splice' | 'chop'
export const SLICE_MODES: readonly SliceMode[] = ['slice', 'splice', 'chop']

const round = (value: number) => Math.round(value * 1000) / 1000

/** Start and end of the played region, 0..1. Defaults (0 and 1) are not written. */
export function setRegion(trackId: ID, begin: number, end: number): Recipe {
  return (project) => {
    const track = project.tracks.find((t) => t.id === trackId)
    if (!track) return
    const b = round(Math.min(Math.max(0, begin), 0.999))
    const e = round(Math.max(Math.min(1, end), b + 0.001))
    if (b === 0) delete track.params.begin
    else track.params.begin = b
    if (e === 1) delete track.params.end
    else track.params.end = e
  }
}

/** `0 1 2 ... n-1`: every slice once, in order. */
export const inOrder = (parts: number) => Array.from({ length: parts }, (_, i) => String(i)).join(' ')

/**
 * Cuts the sample into `parts` with one of `slice`, `splice` or `chop`, replacing any other of the
 * three; null removes it. A slice pattern the user wrote is kept while the number of parts stays.
 */
export function setSlicing(trackId: ID, mode: SliceMode | null, parts: number, newIdFn: IdFactory = newId): Recipe {
  return (project) => {
    const track = project.tracks.find((t) => t.id === trackId)
    if (!track) return
    const index = track.transforms.findIndex((t) => (SLICE_MODES as readonly string[]).includes(t.type))
    const existing = index >= 0 ? track.transforms[index] : undefined
    track.transforms = track.transforms.filter(
      (t, i) => i === index || !(SLICE_MODES as readonly string[]).includes(t.type),
    )
    if (mode === null) {
      if (existing) track.transforms = track.transforms.filter((t) => t !== existing)
      return
    }
    const keptPattern =
      existing &&
      existing.type !== 'chop' &&
      existing.args['parts'] === parts &&
      typeof existing.args['pattern'] === 'string'
        ? existing.args['pattern']
        : inOrder(parts)
    const args = mode === 'chop' ? { parts } : { parts, pattern: keptPattern }
    if (existing) {
      existing.type = mode
      existing.args = args
      existing.enabled = true
    } else track.transforms.push({ id: newIdFn(), type: mode, args, enabled: true })
  }
}

/** Stretches the sample over `cycles` cycles with `loopAt`; null removes it. */
export function setLoopAt(trackId: ID, cycles: number | null, newIdFn: IdFactory = newId): Recipe {
  return (project) => {
    const track = project.tracks.find((t) => t.id === trackId)
    if (!track) return
    const existing = track.transforms.find((t) => t.type === 'loopAt')
    if (cycles === null) {
      track.transforms = track.transforms.filter((t) => t.type !== 'loopAt')
    } else if (existing) {
      existing.args = { cycles }
      existing.enabled = true
    } else track.transforms.push({ id: newIdFn(), type: 'loopAt', args: { cycles }, enabled: true })
  }
}

/** The cycle count closest to the sample's length at this tempo, as a power of two (1 to 16). */
export function suggestedCycles(seconds: number, bpm: number, beatsPerCycle: number): number {
  const cycles = seconds / ((60 / bpm) * beatsPerCycle)
  const power = Math.round(Math.log2(Math.max(cycles, 1)))
  return 2 ** Math.min(4, Math.max(0, power))
}
