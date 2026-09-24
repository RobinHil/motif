// Connects MIDI input to the project (SPEC 8): MIDI learn, mapped controls, note preview and
// recording into the piano roll. App layer: the MIDI module and the engine know nothing of stores.
import { getCycle, isPlaying, previewSound } from '../engine/engine'
import { listenToMidi, type MidiMessage } from '../midi/midi-input'
import { quantizeNote } from '../midi/quantize'
import { ccValue, learnMapping, mappingsFor, targetSpec } from '../midi/targets'
import type { ID, Note, Track } from '../model/project'
import { midiToNoteName, nearestDegree, parseScale } from '../model/scales'
import { pianoRollStore } from '../screens/pianoroll/piano-roll-store'
import { addNote } from '../store/actions'
import { midiStore, type MidiDevice } from '../store/midi-store'
import { projectStore } from '../store/project-store'
import { settingsStore } from '../store/settings-store'
import { uiStore } from '../store/ui-store'

/** A knob turned on a controller sends many values: they are one undo step once it rests this long. */
const GESTURE_IDLE_MS = 400

/** Keeps devices seen earlier, marked disconnected, so the settings list them after unplugging. */
export function mergeDevices(previous: readonly MidiDevice[], connected: readonly string[]): MidiDevice[] {
  const names = [...new Set([...previous.map((d) => d.name), ...connected])]
  return names.map((name) => ({ name, connected: connected.includes(name) }))
}

/** The notes track the piano roll edits: the selected track, or the first notes track. */
export function pianoRollTrack(tracks: readonly Track[], selectedId: ID | null): Track | undefined {
  return tracks.find((t) => t.id === selectedId && t.kind === 'notes') ?? tracks.find((t) => t.kind === 'notes')
}

/** The pitch a played MIDI note gets on a track: a note name, or the nearest scale degree. */
export function pitchFor(track: Track, midi: number): Note['pitch'] {
  const scale = track.notes?.scale ? parseScale(track.notes.scale) : null
  return track.notes?.mode === 'degree' && scale ? nearestDegree(midi, scale) : midiToNoteName(midi)
}

function preview(note: number, velocity: number) {
  const { project } = projectStore.getState()
  const track = project.tracks.find((t) => t.id === uiStore.getState().selectedTrackId)
  if (!track) return
  const gain = Math.round((velocity / 127) * 100) / 100
  if (track.kind === 'notes' && track.source.type !== 'bank') {
    void previewSound({ s: track.source.name, note, velocity: gain }, 0.6)
  } else if (track.kind === 'steps') {
    // Drum pads: C2 (36) plays the first row, C#2 the second...
    const row = track.steps?.rows[note - 36]
    if (row)
      void previewSound({
        s: row.sound,
        n: row.variant ?? 0,
        velocity: gain,
        ...(track.source.type === 'bank' ? { bank: track.source.bank } : {}),
      })
  }
}

export function startMidiBridge(): () => void {
  let gestureTimer: ReturnType<typeof setTimeout> | null = null
  /** Notes held down: MIDI note -> the cycle it started on and its velocity. */
  const held = new Map<number, { cycle: number; velocity: number }>()

  const control = (message: Extract<MidiMessage, { kind: 'cc' }>) => {
    const midi = midiStore.getState()
    const store = projectStore.getState()
    if (midi.learning && midi.learnTarget) {
      const spec = targetSpec(store.project, midi.learnTarget)
      store.update(
        learnMapping({
          deviceName: message.device,
          channel: message.channel,
          cc: message.controller,
          target: midi.learnTarget,
        }),
      )
      uiStore
        .getState()
        .setNotice(
          `CC ${String(message.controller)} on ${message.device} now controls ${spec?.label ?? 'this control'}.`,
        )
      // Learning goes on: the next control clicked gets the next mapping.
      midi.pickTarget(null)
      return
    }
    const mappings = mappingsFor(store.project.midiMappings, message.device, message.channel, message.controller)
    if (mappings.length === 0) return
    if (gestureTimer === null) store.beginGesture()
    else clearTimeout(gestureTimer)
    gestureTimer = setTimeout(() => {
      gestureTimer = null
      projectStore.getState().endGesture()
    }, GESTURE_IDLE_MS)
    for (const mapping of mappings) {
      const spec = targetSpec(projectStore.getState().project, mapping.target)
      const recipe = spec?.apply(ccValue(message.value, spec.range))
      if (recipe) projectStore.getState().update(recipe)
    }
  }

  const record = (note: number, onCycle: number, offCycle: number, velocity: number) => {
    const { project, update } = projectStore.getState()
    const track = pianoRollTrack(project.tracks, uiStore.getState().selectedTrackId)
    if (!track?.notes) return
    const roll = pianoRollStore.getState()
    let placed: { step: number; length: number }
    if (isPlaying()) placed = quantizeNote(onCycle, offCycle, roll.grid)
    else {
      // Stopped: step input at the piano roll's cursor, which then moves on.
      placed = { step: roll.cursor.step, length: Math.min(roll.grid, 16 - roll.cursor.step) }
      roll.set({ cursor: { step: (roll.cursor.step + roll.grid) % 16, midi: note } })
    }
    update(addNote(track.id, { ...placed, pitch: pitchFor(track, note), velocity, probability: 1 }))
  }

  const onMessage = (message: MidiMessage) => {
    if (settingsStore.getState().settings?.midiDisabled.includes(message.device)) return
    midiStore.getState().setLastDevice(message.device)
    if (message.kind === 'cc') control(message)
    else if (message.kind === 'noteon') {
      preview(message.note, message.velocity)
      held.set(message.note, { cycle: getCycle(), velocity: message.velocity })
    } else {
      const start = held.get(message.note)
      held.delete(message.note)
      if (start && midiStore.getState().recording)
        record(message.note, start.cycle, getCycle(), Math.round((start.velocity / 127) * 100) / 100)
    }
  }

  let inputs: Awaited<ReturnType<typeof listenToMidi>> = null
  let stopped = false
  void listenToMidi({
    onMessage,
    onDevices: (connected) => {
      const midi = midiStore.getState()
      midi.setDevices(mergeDevices(midi.devices, connected))
    },
  }).then((result) => {
    midiStore.getState().setSupported(result !== null)
    if (stopped) result?.stop()
    else inputs = result
  })
  return () => {
    stopped = true
    inputs?.stop()
  }
}
