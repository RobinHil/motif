import { SCALE_NAME, SOUND_NAME, type ID, type Project, type Track } from '../model/project'
import { formatNumber, quote, safeToken } from './format'
import { notesPattern } from './notes'
import { paramsCode } from './params'
import { stepsPattern } from './steps'
import { transformsCode } from './transforms'

export interface LineRange {
  /** First line of the track's block, 1-based. */
  from: number
  /** Last line of the track's block, inclusive. */
  to: number
}

export interface TrackBlock {
  trackId: ID
  /** The block exactly as it appears in `code`, starting with `$: ` or `_$: `. */
  code: string
}

export interface GeneratedCode {
  code: string
  lineMap: Record<ID, LineRange>
  /** The first line, `setcpm(...)`. */
  header: string
  blocks: TrackBlock[]
}

function soundCode(track: Track): string {
  const { source } = track
  if (track.kind === 'code') return ''
  if (source.type === 'bank') return `.bank(${quote(safeToken(source.bank, SOUND_NAME, 'bank'))})`
  // Rows name their own sounds on step tracks; only a drum bank applies to them.
  if (track.kind === 'steps') return ''
  return `.s(${quote(safeToken(source.name, SOUND_NAME, 'sound name'))})`
}

function patternCode(track: Track, prefixLength: number): string {
  switch (track.kind) {
    case 'steps':
      return track.steps ? stepsPattern(track.steps, prefixLength) : 's("~")'
    case 'notes': {
      if (!track.notes) return 'note("~")'
      const scale =
        track.notes.mode === 'degree' && track.notes.scale !== undefined
          ? `.scale(${quote(safeToken(track.notes.scale, SCALE_NAME, 'scale'))})`
          : ''
      return notesPattern(track.notes) + scale
    }
    case 'code':
      return track.code?.trim() || 'silence'
  }
}

/**
 * The code a structured track would contribute as free code: pattern, scale, sound and transforms.
 * Mixer parameters and the orbit stay on the track, so converting does not change the sound.
 */
export function trackToFreeCode(track: Track): string {
  return patternCode(track, 0) + soundCode(track) + transformsCode(track.transforms)
}

/** One track as a `$:` block (SPEC 4, rules 2 to 5 and 9). */
export function generateTrackCode(track: Track, muted: boolean): string {
  const prefix = muted ? '_$: ' : '$: '
  const pattern = patternCode(track, prefix.length)
  const suffix =
    soundCode(track) + paramsCode(track.params, track.bypassed) + transformsCode(track.transforms) + `.orbit(${String(track.orbit)})`
  // Free code ending in a line comment would swallow the suffix: start it on a new line.
  const lastLine = pattern.slice(pattern.lastIndexOf('\n') + 1)
  const separator = track.kind === 'code' && lastLine.includes('//') ? '\n  ' : ''
  return `${prefix}${pattern}${separator}${suffix}`
}

/**
 * Generates the Strudel program of a project (SPEC 4). Pure: the same project always gives the
 * same code, byte for byte. With `sceneId`, tracks outside the scene are muted.
 */
export function generateProjectCode(project: Project, options: { sceneId?: ID } = {}): GeneratedCode {
  let inScene: ((track: Track) => boolean) | null = null
  if (options.sceneId !== undefined) {
    const scene = project.scenes.find((s) => s.id === options.sceneId)
    if (!scene) throw new Error(`Unknown scene ${options.sceneId}`)
    const active = new Set(scene.activeTrackIds)
    inScene = (track) => active.has(track.id)
  }

  const anySolo = project.tracks.some((t) => t.solo)
  const header = `setcpm(${formatNumber(project.transport.bpm)}/${formatNumber(project.transport.beatsPerCycle)})`
  const lines = [header]
  const lineMap: Record<ID, LineRange> = {}
  const blocks: TrackBlock[] = []

  if (project.tracks.length > 0) lines.push('')
  for (const track of project.tracks) {
    const muted = track.mute || (anySolo && !track.solo) || (inScene !== null && !inScene(track))
    const code = generateTrackCode(track, muted)
    const from = lines.length + 1
    lines.push(...code.split('\n'))
    lineMap[track.id] = { from, to: lines.length }
    blocks.push({ trackId: track.id, code })
  }

  return { code: `${lines.join('\n')}\n`, lineMap, header, blocks }
}
