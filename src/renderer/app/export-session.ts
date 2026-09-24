// Export (SPEC 9): real-time WAV of the master and stems, free output recording, and code only.
import type { ExportFile } from '@shared/ipc'
import { generateSongCode, songLength } from '../codegen/song'
import { generateProjectCode } from '../codegen/generate'
import { replExportCode } from '../codegen/repl-export'
import { renderCycles, startOutputRecording, type RenderedAudio } from '../engine/engine'
import { encodeWav } from '../engine/wav'
import { usedSoundNames } from '../model/samples'
import { projectStore } from '../store/project-store'
import { recordingStore } from '../store/recording-store'
import { transportStore } from '../store/transport-store'
import { uiStore } from '../store/ui-store'
import type { Catalog } from './sound-catalog'

/** File names for a render: the master, then one per track (stems), named after the project. */
export function audioFiles(
  audio: RenderedAudio,
  projectName: string,
  tracks: readonly { name: string; orbit: number }[],
  bitDepth: 16 | 24,
): ExportFile[] {
  const base = projectName.trim() || 'Motif'
  const files = [{ name: `${base}.wav`, data: encodeWav(audio.master, audio.sampleRate, bitDepth) }]
  for (const track of tracks) {
    const stem = audio.stems.get(track.orbit)
    if (stem) files.push({ name: `${base} - ${track.name}.wav`, data: encodeWav(stem, audio.sampleRate, bitDepth) })
  }
  return files
}

async function save(files: ExportFile[], kind: 'wav' | 'js', dropped = 0): Promise<string | null> {
  const result = await window.motif.export.save(files, kind)
  if (result.status === 'canceled') return null
  if (result.status === 'error') return `Could not export: ${result.message}`
  const gap =
    dropped > 0 ? ` Warning: ${String(dropped)} audio frames were missed; export again with fewer programs open.` : ''
  return `Exported to ${result.where}.${gap}`
}

function heardTracks() {
  const { tracks } = projectStore.getState().project
  const anySolo = tracks.some((t) => t.solo)
  return tracks.filter((t) => !t.mute && (!anySolo || t.solo))
}

/**
 * Plays `cycles` cycles from the start in real time and saves them (the whole song when `song`).
 * Returns the message to show, or null when the save was canceled.
 */
export async function exportAudio(
  options: { cycles: number; song: boolean },
  onProgress: (done: number) => void,
): Promise<string | null> {
  const recording = recordingStore.getState()
  const transport = transportStore.getState()
  const mode = transport.arrangeMode
  const { project } = projectStore.getState()
  const cycles = options.song ? songLength(project) : options.cycles
  if (cycles <= 0) return 'Nothing to export: the song has no sections.'
  recording.set({ exporting: true })
  if (options.song) transport.setArrangeMode('song')
  transport.setPlaying(true)
  try {
    const tracks = recording.stems ? heardTracks() : []
    const audio = await renderCycles(
      cycles,
      tracks.map((t) => t.orbit),
      onProgress,
    )
    return await save(audioFiles(audio, project.meta.name, tracks, recording.bitDepth), 'wav', audio.droppedFrames)
  } finally {
    transportStore.getState().setPlaying(false)
    if (options.song) transportStore.getState().setArrangeMode(mode)
    recordingStore.getState().set({ exporting: false })
  }
}

let stopRecording: (() => Promise<RenderedAudio>) | null = null

/** "Record output" and the record button: starts, or stops and saves. */
export async function toggleOutputRecording(): Promise<void> {
  const recording = recordingStore.getState()
  if (!stopRecording) {
    const tracks = recording.stems ? heardTracks() : []
    stopRecording = await startOutputRecording(tracks.map((t) => t.orbit))
    recordingStore.getState().set({ recording: true })
    return
  }
  const stop = stopRecording
  stopRecording = null
  recordingStore.getState().set({ recording: false })
  const audio = await stop()
  const tracks = recording.stems ? heardTracks() : []
  const message = await save(
    audioFiles(audio, projectStore.getState().project.meta.name, tracks, recording.bitDepth),
    'wav',
    audio.droppedFrames,
  )
  if (message) uiStore.getState().setNotice(message)
}

/** The code to paste into strudel.cc: the loop, or the song. */
export function exportedCode(song: boolean, catalog: Catalog): string {
  const { project } = projectStore.getState()
  const code = song ? generateSongCode(project).code : generateProjectCode(project).code
  const motifOnly = catalog.sounds
    .filter((s) => s.category === 'Textures' || s.category === 'Instruments' || s.category === 'My samples')
    .map((s) => s.name)
  const used = usedSoundNames(project)
  return replExportCode(
    code,
    project.meta.name,
    motifOnly.filter((name) => used.has(name)),
  )
}

export async function exportCode(song: boolean, catalog: Catalog): Promise<string | null> {
  const name = projectStore.getState().project.meta.name.trim() || 'Motif'
  const data = new TextEncoder().encode(exportedCode(song, catalog)).buffer
  return save([{ name: `${name}.js`, data }], 'js')
}
