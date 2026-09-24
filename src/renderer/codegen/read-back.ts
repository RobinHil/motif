// Direct edit (SPEC 6.6): turns an edited program back into the project. Pure.
import { createTrack, nextColor, newId, type IdFactory } from '../model/defaults'
import type { ID, Project, Track } from '../model/project'
import { generateTrackCode } from './generate'
import { parseTrackBlock } from './parse'

export interface ProgramBlock {
  /** 1-based line where the block (or its leading comments) starts. */
  line: number
  text: string
  orbit: number | null
}

export interface SplitProgram {
  header: string[]
  blocks: ProgramBlock[]
}

const BLOCK_START = /^\s*_?\$:/
const COMMENT = /^\s*\/\//
const ORBIT = /\.orbit\(\s*(\d+)\s*\)(?![\s\S]*\.orbit\()/

/** Header lines, then one block per `$:`. Comment lines right above a `$:` belong to that block. */
export function splitProgram(code: string): SplitProgram {
  const lines = code.replace(/\s+$/, '').split('\n')
  const header: string[] = []
  const blocks: { line: number; lines: string[] }[] = []
  let comments: string[] = []
  let commentsLine = 0

  const flushComments = () => {
    const target = blocks.at(-1)
    if (target) target.lines.push(...comments)
    else header.push(...comments)
    comments = []
  }

  for (const [index, line] of lines.entries()) {
    if (BLOCK_START.test(line)) {
      blocks.push({ line: comments.length > 0 ? commentsLine : index + 1, lines: [...comments, line] })
      comments = []
    } else if (COMMENT.test(line)) {
      if (comments.length === 0) commentsLine = index + 1
      comments.push(line)
    } else {
      // Comments followed by code or a blank line are not a block's leading comments.
      flushComments()
      const target = blocks.at(-1)
      if (target) target.lines.push(line)
      else header.push(line)
    }
  }
  flushComments()

  return {
    header,
    blocks: blocks.map((b) => {
      const text = b.lines.join('\n').replace(/\s+$/, '')
      const orbit = ORBIT.exec(text)?.[1]
      return { line: b.line, text, orbit: orbit === undefined ? null : Number(orbit) }
    }),
  }
}

/** Whitespace does not matter in Strudel code, so "the same code" ignores how it is spaced. */
export function sameCode(a: string, b: string): boolean {
  return a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim()
}

export interface PendingConversion {
  trackId: ID
  trackName: string
  /** The text as typed, kept verbatim if the user converts. */
  text: string
  reason: string
}

export interface ReadBackResult {
  /** The project with every change that needs no decision. */
  project: Project
  /** Structured tracks whose code no longer matches what their grid or piano roll can show. */
  pending: PendingConversion[]
  /** Problems that prevent applying the edit; nothing is applied when there is one. */
  errors: string[]
}

const LABEL = /^\s*(_?)\$:\s?/

function stripFreeCode(
  text: string,
  track: Track | null,
): { code: string; muted: boolean; keepMixer: boolean; orbit: number | null } {
  // Leading comment lines stay in the code, after the label: `$: // Drums` then the pattern.
  const lines = text.split('\n')
  const firstCode = lines.findIndex((line) => !COMMENT.test(line))
  const comments = firstCode > 0 ? lines.slice(0, firstCode) : []
  const rest = firstCode > 0 ? lines.slice(firstCode).join('\n') : text
  const label = LABEL.exec(rest)
  const muted = label?.[1] === '_'
  let body = label ? rest.slice(label[0].length) : rest
  body = [...comments.map((c) => c.trim()), body].join('\n').replace(/\s+$/, '')
  if (track) {
    // Unchanged mixer suffix: keep the track's parameters and transforms.
    const suffix = generateTrackCode({ ...track, code: '' }, false).slice('$: silence'.length)
    if (body.endsWith(suffix))
      return { code: body.slice(0, -suffix.length).replace(/\s+$/, ''), muted, keepMixer: true, orbit: track.orbit }
  }
  const orbit = /\s*\.orbit\(\s*(\d+)\s*\)$/.exec(body)
  if (orbit?.[1]) return { code: body.slice(0, orbit.index), muted, keepMixer: false, orbit: Number(orbit[1]) }
  return { code: body, muted, keepMixer: false, orbit: null }
}

/** The code of a converted track: the typed text without `$:` and without the final `.orbit(n)`. */
export function asFreeCode(track: Track, text: string): Track {
  const { code, muted } = stripFreeCode(text, null)
  const { steps: _steps, notes: _notes, ...rest } = track
  return { ...rest, kind: 'code', code, mute: muted, params: { gain: 1, pan: 0.5 }, transforms: [] }
}

function mutedByContext(project: Project, track: Track): boolean {
  const anySolo = project.tracks.some((t) => t.solo)
  return track.mute || (anySolo && !track.solo)
}

/** Only the mute flag can be set from `_$:`; a track silenced by another track's solo stays so. */
function applyMute(project: Project, track: Track, muted: boolean): Track {
  const soloedOut = project.tracks.some((t) => t.solo) && !track.solo
  return soloedOut ? track : { ...track, mute: muted }
}

export function readBack(code: string, project: Project, newIdFn: IdFactory = newId): ReadBackResult {
  const { header, blocks } = splitProgram(code)
  const errors: string[] = []

  let transport = project.transport
  for (const line of header) {
    if (line.trim() === '') continue
    const tempo = /^\s*setcpm\(\s*([\d.]+)\s*\/\s*(\d+)\s*\)\s*;?\s*$/.exec(line)
    if (tempo) transport = { bpm: Number(tempo[1]), beatsPerCycle: Number(tempo[2]) }
    else errors.push(`Only setcpm(...) can stay above the first track. Move "${line.trim()}" into a $: block.`)
  }

  const byOrbit = new Map(project.tracks.map((t) => [t.orbit, t]))
  const claimed = new Set<number>()
  for (const block of blocks) {
    if (block.orbit === null) continue
    if (claimed.has(block.orbit))
      errors.push(`Two tracks end with .orbit(${String(block.orbit)}): each track needs its own orbit.`)
    claimed.add(block.orbit)
  }
  if (errors.length > 0) return { project, pending: [], errors }

  const context: Project = { ...project, transport }
  const tracks: Track[] = []
  const pending: PendingConversion[] = []

  for (const block of blocks) {
    const track = block.orbit === null ? undefined : byOrbit.get(block.orbit)
    if (!track) {
      // A new block becomes a free code track.
      const created = createTrack('code', tracks, newIdFn)
      const { code: freeCode, muted, orbit } = stripFreeCode(block.text, null)
      // Orbits of the tracks that stay (their blocks are still in the code) are taken.
      const taken = new Set([...claimed, ...tracks.map((t) => t.orbit)])
      let free = 1
      while (taken.has(free)) free++
      const chosen = orbit !== null && !tracks.some((t) => t.orbit === orbit) ? orbit : free
      claimed.add(chosen)
      tracks.push({
        ...created,
        color: nextColor(tracks),
        orbit: chosen,
        code: freeCode,
        mute: muted,
      })
      continue
    }

    const generated = generateTrackCode(track, mutedByContext(project, track))
    if (sameCode(generated, block.text)) {
      tracks.push(track)
      continue
    }

    if (track.kind === 'code') {
      const stripped = stripFreeCode(block.text, track)
      const edited: Track = stripped.keepMixer
        ? { ...track, code: stripped.code }
        : { ...track, code: stripped.code, params: { gain: 1, pan: 0.5 }, transforms: [] }
      tracks.push(applyMute(project, edited, stripped.muted))
      continue
    }

    const parsed = parseTrackBlock(block.text, track, newIdFn)
    if (parsed.ok) {
      const candidate = applyMute(project, parsed.track, parsed.muted)
      const muted = mutedByContext(
        { ...project, tracks: project.tracks.map((t) => (t.id === track.id ? candidate : t)) },
        candidate,
      )
      // A track silenced by another track's solo keeps its `_$:`, whatever was typed.
      const typed = muted ? block.text.replace(LABEL, '_$: ') : block.text
      if (sameCode(generateTrackCode(candidate, muted), typed)) {
        tracks.push(candidate)
        continue
      }
    }
    pending.push({
      trackId: track.id,
      trackName: track.name,
      text: block.text,
      reason: parsed.ok ? 'The code is valid but the grid cannot show it exactly.' : parsed.reason,
    })
    tracks.push(track)
  }

  const kept = new Set(tracks.map((t) => t.id))
  const next: Project = {
    ...context,
    tracks,
    scenes: project.scenes.map((s) => ({ ...s, activeTrackIds: s.activeTrackIds.filter((id) => kept.has(id)) })),
    automations: project.automations.filter((a) => a.target.trackId === 'master' || kept.has(a.target.trackId)),
    midiMappings: project.midiMappings.filter((m) => m.target.trackId === 'master' || kept.has(m.target.trackId)),
  }
  return { project: next, pending, errors: [] }
}

/** Applies the user's choice for the blocks that did not fit their track anymore. */
export function resolvePending(
  project: Project,
  pending: readonly PendingConversion[],
  choice: 'convert' | 'undo',
): Project {
  if (choice === 'undo') return project
  const byId = new Map(pending.map((p) => [p.trackId, p]))
  return {
    ...project,
    tracks: project.tracks.map((t) => (byId.has(t.id) ? asFreeCode(t, byId.get(t.id)?.text ?? '') : t)),
  }
}
