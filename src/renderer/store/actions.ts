// Named edits on the project. Each one is a recipe for `ProjectState.update`, so every action is
// undoable and components never mutate the model directly.
import { current, type Draft } from 'immer'
import { trackToFreeCode } from '../codegen/generate'
import {
  createStepRow,
  createTrack,
  createTransform,
  newId,
  nextColor,
  nextOrbit,
  type IdFactory,
} from '../model/defaults'
import type {
  ID,
  Note,
  ParamKey,
  ParamValue,
  Project,
  SoundSource,
  Step,
  Track,
  TrackColor,
  TrackKind,
  TransformType,
} from '../model/project'
import type { Recipe } from './project-store'

type DraftTrack = Draft<Track>

function withTrack(trackId: ID, edit: (track: DraftTrack, project: Draft<Project>) => void): Recipe {
  return (project) => {
    const track = project.tracks.find((t) => t.id === trackId)
    if (track) edit(track, project)
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function addTrack(kind: TrackKind, newIdFn: IdFactory = newId): { id: ID; recipe: Recipe } {
  const id = newIdFn()
  return {
    id,
    recipe: (project) => {
      project.tracks.push({ ...createTrack(kind, project.tracks, newIdFn), id })
    },
  }
}

export const removeTrack =
  (trackId: ID): Recipe =>
  (project) => {
    project.tracks = project.tracks.filter((t) => t.id !== trackId)
    for (const scene of project.scenes) scene.activeTrackIds = scene.activeTrackIds.filter((id) => id !== trackId)
    project.automations = project.automations.filter((a) => a.target.trackId !== trackId)
    project.midiMappings = project.midiMappings.filter((m) => m.target.trackId !== trackId)
  }

export function duplicateTrack(trackId: ID, newIdFn: IdFactory = newId): { id: ID; recipe: Recipe } {
  const id = newIdFn()
  return {
    id,
    recipe: (project) => {
      const index = project.tracks.findIndex((t) => t.id === trackId)
      const source = project.tracks[index]
      if (!source) return
      const copy = structuredClone(current(source))
      copy.id = id
      copy.name = `${source.name} copy`
      copy.orbit = nextOrbit(project.tracks)
      copy.color = nextColor(project.tracks)
      copy.solo = false
      copy.steps?.rows.forEach((row) => (row.id = newIdFn()))
      copy.notes?.notes.forEach((note) => (note.id = newIdFn()))
      copy.transforms.forEach((transform) => (transform.id = newIdFn()))
      project.tracks.splice(index + 1, 0, copy)
    },
  }
}

export const moveTrack =
  (trackId: ID, toIndex: number): Recipe =>
  (project) => {
    const from = project.tracks.findIndex((t) => t.id === trackId)
    if (from < 0) return
    const [track] = project.tracks.splice(from, 1)
    if (track) project.tracks.splice(clamp(toIndex, 0, project.tracks.length), 0, track)
  }

export const renameTrack = (trackId: ID, name: string): Recipe =>
  withTrack(trackId, (track) => {
    track.name = name.trim().slice(0, 100) || track.name
  })

export const setTrackColor = (trackId: ID, color: TrackColor): Recipe =>
  withTrack(trackId, (track) => {
    track.color = color
  })

export const setMute = (trackId: ID, mute: boolean): Recipe =>
  withTrack(trackId, (track) => {
    track.mute = mute
  })

export const setSolo = (trackId: ID, solo: boolean): Recipe =>
  withTrack(trackId, (track) => {
    track.solo = solo
  })

export const setSource = (trackId: ID, source: SoundSource): Recipe =>
  withTrack(trackId, (track) => {
    track.source = source
  })

/** `undefined` removes an optional parameter (filter open, no reverb...). gain and pan are required. */
export const setParam = (trackId: ID, key: ParamKey, value: ParamValue | string | undefined): Recipe =>
  withTrack(trackId, (track) => {
    const params = track.params as Record<string, unknown>
    if (value !== undefined) params[key] = value
    else if (key !== 'gain' && key !== 'pan') Reflect.deleteProperty(params, key)
  })

export const setCode = (trackId: ID, code: string): Recipe =>
  withTrack(trackId, (track) => {
    if (track.kind === 'code') track.code = code
  })

export const setBpm =
  (bpm: number): Recipe =>
  (project) => {
    project.transport.bpm = clamp(Math.round(bpm * 10) / 10, 20, 400)
  }

export const toggleStep = (trackId: ID, rowId: ID, index: number): Recipe =>
  withTrack(trackId, (track) => {
    const row = track.steps?.rows.find((r) => r.id === rowId)
    if (!row || index < 0 || index >= row.steps.length) return
    row.steps[index] = row.steps[index] ? null : { velocity: 1, probability: 1 }
  })

export const setStep = (trackId: ID, rowId: ID, index: number, step: Step | null): Recipe =>
  withTrack(trackId, (track) => {
    const row = track.steps?.rows.find((r) => r.id === rowId)
    if (!row || index < 0 || index >= row.steps.length) return
    row.steps[index] = step && { velocity: clamp(step.velocity, 0, 1), probability: clamp(step.probability, 0, 1) }
  })

export function addRow(trackId: ID, sound: string, newIdFn: IdFactory = newId): Recipe {
  return withTrack(trackId, (track) => {
    track.steps?.rows.push(createStepRow(sound, newIdFn))
  })
}

export const removeRow = (trackId: ID, rowId: ID): Recipe =>
  withTrack(trackId, (track) => {
    if (track.steps) track.steps.rows = track.steps.rows.filter((r) => r.id !== rowId)
  })

export function addNote(trackId: ID, note: Omit<Note, 'id'>, newIdFn: IdFactory = newId): Recipe {
  return withTrack(trackId, (track) => {
    track.notes?.notes.push({ ...note, id: newIdFn() })
  })
}

export const updateNote = (trackId: ID, noteId: ID, changes: Partial<Omit<Note, 'id'>>): Recipe =>
  withTrack(trackId, (track) => {
    const note = track.notes?.notes.find((n) => n.id === noteId)
    if (note) Object.assign(note, changes)
  })

export const removeNote = (trackId: ID, noteId: ID): Recipe =>
  withTrack(trackId, (track) => {
    if (track.notes) track.notes.notes = track.notes.notes.filter((n) => n.id !== noteId)
  })

export function addTransform(trackId: ID, type: TransformType, newIdFn: IdFactory = newId): Recipe {
  return withTrack(trackId, (track) => {
    track.transforms.push(createTransform(type, newIdFn))
  })
}

export const removeTransform = (trackId: ID, transformId: ID): Recipe =>
  withTrack(trackId, (track) => {
    track.transforms = track.transforms.filter((t) => t.id !== transformId)
  })

export const setTransformEnabled = (trackId: ID, transformId: ID, enabled: boolean): Recipe =>
  withTrack(trackId, (track) => {
    const transform = track.transforms.find((t) => t.id === transformId)
    if (transform) transform.enabled = enabled
  })

export const setTransformArg = (trackId: ID, transformId: ID, key: string, value: number | string): Recipe =>
  withTrack(trackId, (track) => {
    const transform = track.transforms.find((t) => t.id === transformId)
    if (transform) transform.args[key] = value
  })

/** Replaces the sound of one row of a step track (dropping a sound on a row). */
export const setRowSound = (trackId: ID, rowId: ID, sound: string): Recipe =>
  withTrack(trackId, (track) => {
    const row = track.steps?.rows.find((r) => r.id === rowId)
    if (row) {
      row.sound = sound
      delete row.variant
    }
  })

/** Turns a step or note track into free code that plays the same thing (track context menu). */
export const convertToFreeCode = (trackId: ID): Recipe =>
  withTrack(trackId, (track) => {
    if (track.kind === 'code') return
    const code = trackToFreeCode(current(track))
    track.kind = 'code'
    track.code = code
    track.transforms = []
    delete track.steps
    delete track.notes
  })

export type DroppedSound = { kind: 'sound'; name: string; category: string } | { kind: 'bank'; bank: string }

/**
 * Dropping from the sound browser onto a track (SPEC 6.1): a bank sets a step track's bank, a sound
 * adds a row to a step track or becomes a note track's instrument. Free code sets its own sounds.
 */
export function dropOnTrack(trackId: ID, dropped: DroppedSound, newIdFn: IdFactory = newId): Recipe {
  return withTrack(trackId, (track) => {
    if (track.kind === 'steps') {
      if (dropped.kind === 'bank') track.source = { type: 'bank', bank: dropped.bank }
      else track.steps?.rows.push(createStepRow(dropped.name, newIdFn))
    } else if (track.kind === 'notes' && dropped.kind === 'sound') {
      track.source = { type: dropped.category === 'Synths' ? 'synth' : 'sample', name: dropped.name }
    }
  })
}

/** Sample variant of a whole row: `bd:2`. `undefined` goes back to the first sample. */
export const setVariant = (trackId: ID, rowId: ID, variant: number | undefined): Recipe =>
  withTrack(trackId, (track) => {
    const row = track.steps?.rows.find((r) => r.id === rowId)
    if (!row) return
    if (variant === undefined) delete row.variant
    else row.variant = Math.max(0, Math.round(variant))
  })
