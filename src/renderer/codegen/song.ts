// The song program (SPEC 6.5, Song mode): one constant per track, one `stack(...)` per scene, then
// `arrange(...)` over the sections, with automations as ramps. Pure, like the rest of codegen.
import type { Automation, ID, ParamKey, Project, Track } from '../model/project'
import { formatNumber } from './format'
import { trackCode, type GeneratedCode, type LineRange, type TrackBlock } from './generate'

export interface Section {
  id: ID
  sceneId: ID
  start: number
  length: number
}

/** Sections in time order. A section starting inside the previous one is moved to its end. */
export function songSections(project: Project): Section[] {
  const sections: Section[] = []
  let end = 0
  const blocks = [...project.arrangement].sort((a, b) => a.startCycle - b.startCycle)
  for (const block of blocks) {
    const scene = project.scenes.find((s) => s.id === block.sceneId)
    if (!scene) continue
    const start = Math.max(block.startCycle, end)
    const length = block.lengthCycles ?? scene.lengthCycles
    sections.push({ id: block.id, sceneId: block.sceneId, start, length })
    end = start + length
  }
  return sections
}

export function songLength(project: Project): number {
  const last = songSections(project).at(-1)
  return last ? last.start + last.length : 0
}

const JS_WORDS = new Set(
  'await break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof let new null return super switch this throw true try typeof var void while with yield'.split(
    ' ',
  ),
)
/** Names the song code itself calls. */
const SONG_WORDS = ['stack', 'arrange', 'silence', 'saw', 'setcpm', 'filterWhen']

/** Identifiers used bare (not after a dot) in code, which a constant must not hide. */
export function bareWords(code: string): Set<string> {
  return new Set(code.match(/(?<![.\w$])[A-Za-z_$][\w$]*/g) ?? [])
}

/** `Lead Synth` -> `lead_synth`, never a taken or reserved name. */
export function identifierFrom(name: string, taken: Set<string>, avoid: ReadonlySet<string>): string {
  let base = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!/^[a-z]/.test(base)) base = `t_${base}`.replace(/_+$/, '')
  if (JS_WORDS.has(base) || avoid.has(base)) base = `${base}_`
  let candidate = base
  for (let i = 2; taken.has(candidate) || avoid.has(candidate); i++) candidate = `${base}_${String(i)}`
  taken.add(candidate)
  return candidate
}

/** Linear ramps between automation points, as `arrange` sections over the song's length. */
export function automationPattern(automation: Automation, total: number): string | null {
  const points = [...automation.points].filter((p) => p.cycle <= total).sort((a, b) => a.cycle - b.cycle)
  const first = points[0]
  const last = points.at(-1)
  if (!first || !last || total <= 0) return null
  const hold = (value: number) => `"${formatNumber(value)}"`
  const parts: [number, string][] = []
  if (first.cycle > 0) parts.push([first.cycle, hold(first.value)])
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (!a || !b || b.cycle <= a.cycle) continue
    const length = b.cycle - a.cycle
    parts.push([
      length,
      a.value === b.value
        ? hold(a.value)
        : `saw.range(${formatNumber(a.value)}, ${formatNumber(b.value)})${length === 1 ? '' : `.slow(${formatNumber(length)})`}`,
    ])
  }
  if (last.cycle < total) parts.push([total - last.cycle, hold(last.value)])
  if (parts.length === 1 && parts[0]) return parts[0][1]
  return `arrange(${parts.map(([cycles, code]) => `[${formatNumber(cycles)}, ${code}]`).join(', ')})`
}

/** A master automation of volume goes after the track gains (`postgain`) instead of replacing them. */
const MASTER_CALL: Partial<Record<ParamKey, string>> = { gain: 'postgain' }

/**
 * The song program. Muted tracks, and tracks silenced by a solo, are left out of every scene.
 * Master automations apply to the whole song and replace the tracks' own value of that parameter.
 */
export function generateSongCode(project: Project): GeneratedCode {
  const header = `setcpm(${formatNumber(project.transport.bpm)}/${formatNumber(project.transport.beatsPerCycle)})`
  const sections = songSections(project)
  const total = songLength(project)
  const anySolo = project.tracks.some((t) => t.solo)
  const plays = (track: Track) => !track.mute && (!anySolo || track.solo)

  const avoid = new Set([...SONG_WORDS, ...project.tracks.flatMap((t) => [...bareWords(trackCode(t, ''))])])
  const taken = new Set<string>()
  const names = new Map(project.tracks.map((t) => [t.id, identifierFrom(t.name, taken, avoid)]))

  const automation = (trackId: Automation['target']['trackId']) =>
    Object.fromEntries(
      project.automations
        .filter((a) => a.target.trackId === trackId)
        .flatMap((a) => {
          const code = automationPattern(a, total)
          return code === null ? [] : [[a.target.param, code] as const]
        }),
    ) as Partial<Record<ParamKey, string>>

  const lines = [header, '', '// Tracks']
  const lineMap: Record<ID, LineRange> = {}
  const blocks: TrackBlock[] = []
  for (const track of project.tracks) {
    const name = names.get(track.id) ?? 'track'
    const code = trackCode(track, `const ${name} = `, automation(track.id))
    const from = lines.length + 1
    lines.push(...code.split('\n'))
    lineMap[track.id] = { from, to: lines.length }
    blocks.push({ trackId: track.id, code, fallback: `const ${name} = silence` })
  }

  const used = project.scenes.filter((scene) => sections.some((s) => s.sceneId === scene.id))
  const sceneNames = new Map(used.map((scene) => [scene.id, identifierFrom(scene.name, taken, avoid)]))
  const footer: string[] = ['', '// Each scene is a combination of tracks']
  const width = Math.max(0, ...[...sceneNames.values()].map((n) => n.length))
  for (const scene of used) {
    const members = project.tracks.filter((t) => scene.activeTrackIds.includes(t.id) && plays(t))
    const value = members.length > 0 ? `stack(${members.map((t) => names.get(t.id) ?? '').join(', ')})` : 'silence'
    footer.push(`const ${(sceneNames.get(scene.id) ?? '').padEnd(width)} = ${value}`)
  }
  footer.push('')
  if (sections.length === 0) footer.push('$: silence')
  else {
    const parts: string[] = []
    let cursor = 0
    for (const section of sections) {
      // A gap between sections is silence.
      if (section.start > cursor) parts.push(`[${formatNumber(section.start - cursor)}, silence]`)
      parts.push(`[${formatNumber(section.length)}, ${sceneNames.get(section.sceneId) ?? 'silence'}]`)
      cursor = section.start + section.length
    }
    const song = `$: arrange(${parts.join(', ')})`
    const master = Object.entries(automation('master')).map(
      ([param, code]) => `\n  .${MASTER_CALL[param as ParamKey] ?? param}(${code})`,
    )
    footer.push(song + master.join(''))
  }
  const footerText = footer.join('\n')
  return {
    code: `${[...lines, footerText].join('\n')}\n`,
    lineMap,
    header,
    blocks,
    footer: footerText,
    kind: 'song',
  }
}
