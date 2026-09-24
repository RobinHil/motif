import { SCALE_NAME, SOUND_NAME, type ID, type ParamKey, type Project, type Track } from '../model/project'
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
  /** The block exactly as it appears in `code`: `$: `, `_$: `, or `const name = ` in a song. */
  code: string
  /** Played instead when the block fails and has no earlier valid version (song: `const x = silence`). */
  fallback?: string
}

export interface GeneratedCode {
  code: string
  lineMap: Record<ID, LineRange>
  /** The first line, `setcpm(...)`. */
  header: string
  blocks: TrackBlock[]
  /** Code after the track blocks: the scenes and `arrange(...)` of a song. */
  footer?: string
  /** 'song' for the arrangement program, whose blocks are constants rather than `$:` patterns. */
  kind?: 'loop' | 'song'
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
  return trackCode(track, muted ? '_$: ' : '$: ')
}

/**
 * A track's code after `prefix` (`$: `, `_$: ` or `const drums = `), with parameters replaced by
 * code in `overrides` (automation) and `after` appended at the end.
 */
export function trackCode(
  track: Track,
  prefix: string,
  overrides: Partial<Record<ParamKey, string>> = {},
  after = '',
): string {
  const pattern = patternCode(track, prefix.length)
  const suffix =
    soundCode(track) +
    paramsCode(track.params, track.bypassed, overrides) +
    transformsCode(track.transforms) +
    `.orbit(${String(track.orbit)})` +
    after
  // Free code ending in a line comment would swallow the suffix: start it on a new line.
  const lastLine = pattern.slice(pattern.lastIndexOf('\n') + 1)
  const separator = track.kind === 'code' && lastLine.includes('//') ? '\n  ' : ''
  return `${prefix}${pattern}${separator}${suffix}`
}

export interface LoopOptions {
  /** Live mode: only the tracks of this scene play. Null or absent: every track. */
  sceneId?: ID | null
  /**
   * Live mode, a scene queued for cycle `cycle` while `fromSceneId` plays: the change is written
   * into the pattern with `filterWhen`, so it lands exactly on that cycle whenever it is evaluated.
   */
  switchAt?: { cycle: number; fromSceneId: ID | null }
}

function sceneFilter(project: Project, sceneId: ID | null | undefined): (track: Track) => boolean {
  if (sceneId === undefined || sceneId === null) return () => true
  const scene = project.scenes.find((s) => s.id === sceneId)
  if (!scene) throw new Error(`Unknown scene ${sceneId}`)
  const active = new Set(scene.activeTrackIds)
  return (track) => active.has(track.id)
}

/**
 * Generates the Strudel program of a project (SPEC 4). Pure: the same project always gives the
 * same code, byte for byte. With `sceneId`, tracks outside the scene are muted.
 */
export function generateProjectCode(project: Project, options: LoopOptions = {}): GeneratedCode {
  const inScene = sceneFilter(project, options.sceneId)
  const inPrevious = options.switchAt ? sceneFilter(project, options.switchAt.fromSceneId) : inScene
  const at = options.switchAt ? formatNumber(options.switchAt.cycle) : ''

  const anySolo = project.tracks.some((t) => t.solo)
  const header = `setcpm(${formatNumber(project.transport.bpm)}/${formatNumber(project.transport.beatsPerCycle)})`
  const lines = [header]
  const lineMap: Record<ID, LineRange> = {}
  const blocks: TrackBlock[] = []

  if (project.tracks.length > 0) lines.push('')
  for (const track of project.tracks) {
    const silenced = track.mute || (anySolo && !track.solo)
    const now = inScene(track)
    const before = inPrevious(track)
    const muted = silenced || (!now && !before)
    const after = muted || now === before ? '' : now ? `.filterWhen(t => t >= ${at})` : `.filterWhen(t => t < ${at})`
    const code = trackCode(track, muted ? '_$: ' : '$: ', {}, after)
    const from = lines.length + 1
    lines.push(...code.split('\n'))
    lineMap[track.id] = { from, to: lines.length }
    blocks.push({ trackId: track.id, code })
  }

  return { code: `${lines.join('\n')}\n`, lineMap, header, blocks }
}
