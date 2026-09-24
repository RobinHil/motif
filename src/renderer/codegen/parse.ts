// Reads a structured track back from its code (SPEC 6.6, "Reading code back into the UI").
// The parser only understands what codegen writes. The caller always checks the result by
// regenerating the block, so anything the parser gets wrong is caught and treated as free code.
import { parseExpressionAt, type Expression, type Node } from 'acorn'
import { newId, type IdFactory } from '../model/defaults'
import {
  NOTE_NAME,
  PARAM_ORDER,
  SCALE_NAME,
  SIGNAL_SHAPES,
  SOUND_NAME,
  STEPS_PER_CYCLE,
  TRANSFORM_TYPES,
  VOWEL,
  type Modulation,
  type Note,
  type ParamKey,
  type ParamValue,
  type SignalShape,
  type Step,
  type StepRow,
  type Track,
  type TrackParams,
  type TransformInstance,
  type TransformType,
} from '../model/project'

export type ParseResult = { ok: true; track: Track; muted: boolean } | { ok: false; reason: string }

class ParseError extends Error {}

function fail(reason: string): never {
  throw new ParseError(reason)
}

// acorn's ESTree types, reduced to what the parser reads.
interface Call extends Node {
  type: 'CallExpression'
  callee: Expression
  arguments: Expression[]
}

interface ChainCall {
  name: string
  args: Expression[]
  start: number
  end: number
}

const round3 = (value: number) => Number(value.toFixed(3))

function numberOf(node: Expression | undefined): number {
  if (node?.type === 'Literal' && typeof node.value === 'number') return node.value
  if (node?.type === 'UnaryExpression' && node.operator === '-') return -numberOf(node.argument)
  return fail('Expected a number')
}

function stringOf(node: Expression | undefined): string {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0]?.value.cooked ?? ''
  return fail('Expected a string')
}

/** `a.b(1).c(2)` -> base `a`, calls [b(1), c(2)]. */
function flattenChain(node: Expression): { base: Expression; calls: ChainCall[] } {
  const calls: ChainCall[] = []
  let current: Expression = node
  while (current.type === 'CallExpression' && current.callee.type === 'MemberExpression') {
    const member = current.callee
    if (member.property.type !== 'Identifier' || member.computed) fail('Unexpected call')
    calls.unshift({
      name: member.property.name,
      args: current.arguments as Expression[],
      start: member.property.start - 1,
      end: current.end,
    })
    current = member.object as Expression
  }
  return { base: current, calls }
}

function baseCall(node: Expression, names: readonly string[]): Call {
  if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier' || !names.includes(node.callee.name)) {
    return fail(`Expected ${names.join(' or ')}(...)`)
  }
  return node as Call
}

function calleeName(node: Call): string {
  return node.callee.type === 'Identifier' ? node.callee.name : ''
}

// ---- parameters and transforms -------------------------------------------------------------

function modulationOf(node: Expression): Modulation {
  if (node.type === 'Literal' && typeof node.value === 'string') {
    const match = /^<([^<>]+)>$/.exec(node.value)
    if (!match?.[1]) fail('Unexpected pattern value')
    const values = match[1].trim().split(/\s+/).map(Number)
    if (values.some((v) => !Number.isFinite(v))) fail('Unexpected sequence value')
    return { kind: 'sequence', values }
  }
  const { base, calls } = flattenChain(node)
  const range = calls[0]
  if (
    base.type !== 'Identifier' ||
    !(SIGNAL_SHAPES as readonly string[]).includes(base.name) ||
    range?.name !== 'range'
  ) {
    return fail('Unexpected parameter value')
  }
  const slow = calls[1]
  if (calls.length > 2 || (slow && slow.name !== 'slow')) fail('Unexpected signal')
  return {
    kind: 'signal',
    shape: base.name as SignalShape,
    min: numberOf(range.args[0]),
    max: numberOf(range.args[1]),
    cycles: slow ? numberOf(slow.args[0]) : 1,
  }
}

function paramValueOf(node: Expression | undefined): ParamValue {
  if (!node) return fail('Missing value')
  if ((node.type === 'Literal' && typeof node.value === 'number') || node.type === 'UnaryExpression')
    return numberOf(node)
  return modulationOf(node)
}

/** `x => x.speed(2)` -> 2, checking the method name. */
function arrowCallArg(node: Expression | undefined, method: string): number {
  if (node?.type !== 'ArrowFunctionExpression' || node.params.length !== 1 || node.body.type !== 'CallExpression') {
    return fail('Expected x => x.' + method + '(...)')
  }
  const call = node.body
  if (
    call.callee.type !== 'MemberExpression' ||
    call.callee.property.type !== 'Identifier' ||
    call.callee.property.name !== method
  ) {
    return fail('Unexpected function')
  }
  return numberOf(call.arguments[0] as Expression)
}

function transformOf(call: ChainCall, source: string): Omit<TransformInstance, 'id'> {
  const type = (TRANSFORM_TYPES as readonly string[]).includes(call.name) ? (call.name as TransformType) : 'custom'
  const args: TransformInstance['args'] = {}
  switch (type) {
    case 'fast':
    case 'slow':
    case 'ply':
      args['factor'] = numberOf(call.args[0])
      break
    case 'degradeBy':
      args['amount'] = numberOf(call.args[0])
      break
    case 'chop':
    case 'striate':
      args['parts'] = numberOf(call.args[0])
      break
    case 'loopAt':
      args['cycles'] = numberOf(call.args[0])
      break
    case 'slice':
    case 'splice':
      args['parts'] = numberOf(call.args[0])
      args['pattern'] = stringOf(call.args[1])
      break
    case 'sometimes':
      args['speed'] = arrowCallArg(call.args[0], 'speed')
      break
    case 'lastOf':
      args['every'] = numberOf(call.args[0])
      args['factor'] = arrowCallArg(call.args[1], 'fast')
      break
    case 'rev':
    case 'jux':
      break
    case 'custom':
      args['code'] = source.slice(call.start, call.end)
      break
  }
  return { type, args, enabled: true }
}

// ---- step tracks --------------------------------------------------------------------------

const STEP_TOKEN = /^([A-Za-z0-9_-]+)(?::(\d+))?(?:\?([\d.]+))?$/

function parseRow(text: string, previous: StepRow | undefined, velocities: string | null, newIdFn: IdFactory): StepRow {
  const tokens = text.trim().split(/\s+/)
  if (tokens.length !== STEPS_PER_CYCLE) fail(`A row needs ${String(STEPS_PER_CYCLE)} steps`)
  const velocityTokens = velocities === null ? null : velocities.trim().split(/\s+/)
  if (velocityTokens && velocityTokens.length !== STEPS_PER_CYCLE) fail('Velocities do not line up with the steps')

  let sound: string | null = null
  let variant: number | undefined
  const steps: (Step | null)[] = []
  for (const [i, token] of tokens.entries()) {
    if (token === '~') {
      steps.push(null)
      continue
    }
    const match = STEP_TOKEN.exec(token)
    if (!match?.[1]) return fail(`Unexpected step "${token}"`)
    const tokenVariant = match[2] === undefined ? undefined : Number(match[2])
    if (sound !== null && (match[1] !== sound || tokenVariant !== variant)) fail('A row plays a single sound')
    sound = match[1]
    variant = tokenVariant
    const velocity = velocityTokens ? Number(velocityTokens[i]) : 1
    if (!Number.isFinite(velocity)) fail('Unexpected velocity')
    steps.push({ velocity, probability: match[3] === undefined ? 1 : round3(1 - Number(match[3])) })
  }
  const rowSound: string = sound ?? previous?.sound ?? fail('An empty row has no sound')
  if (!SOUND_NAME.test(rowSound)) fail('Unexpected sound name')
  const keepVariant = sound === null ? previous?.variant : variant
  return {
    id: previous?.id ?? newIdFn(),
    sound: rowSound,
    ...(keepVariant !== undefined ? { variant: keepVariant } : {}),
    steps,
  }
}

function parseStepsBase(base: Expression, previous: Track, newIdFn: IdFactory): StepRow[] {
  const rows = previous.steps?.rows ?? []
  const call = baseCall(base, ['s', 'stack'])
  if (calleeName(call) === 's') {
    const text = stringOf(call.arguments[0])
    if (text.trim() === '~') return []
    return text.split(',').map((row, i) => parseRow(row, rows[i], null, newIdFn))
  }
  return call.arguments.map((arg, i) => {
    const { base: rowBase, calls } = flattenChain(arg)
    const text = stringOf(baseCall(rowBase, ['s']).arguments[0])
    if (calls.length > 1 || (calls[0] && calls[0].name !== 'velocity')) fail('Unexpected call in a row')
    return parseRow(text, rows[i], calls[0] ? stringOf(calls[0].args[0]) : null, newIdFn)
  })
}

// ---- note tracks --------------------------------------------------------------------------

/** Splits on `separator` outside brackets. */
function splitTop(text: string, separator: RegExp): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const char of text) {
    if (char === '[' || char === '<') depth++
    if (char === ']' || char === '>') depth--
    if (depth === 0 && separator.test(char)) {
      if (current !== '') parts.push(current)
      current = ''
    } else {
      current += char
    }
  }
  if (current !== '') parts.push(current)
  return parts
}

type Pitch = Note['pitch']

function pitchOf(text: string, degree: boolean): Pitch {
  if (degree) {
    if (!/^-?\d+$/.test(text)) fail(`Unexpected degree "${text}"`)
    return Number(text)
  }
  if (!NOTE_NAME.test(text)) fail(`Unexpected note "${text}"`)
  return text
}

interface Parsed {
  weight: number
  probability: number
  members: { pitch: Pitch; alternatives?: Pitch[] }[] | null
}

const WEIGHTED = /^(.*?)(?:\?([\d.]+))?(?:@(\d+))?$/

function parseNoteToken(token: string, degree: boolean): Parsed {
  const match = WEIGHTED.exec(token)
  const body = match?.[1] ?? ''
  const weight = match?.[3] ? Number(match[3]) : 1
  const probability = match?.[2] ? round3(1 - Number(match[2])) : 1
  if (body === '~') return { weight, probability, members: null }
  const inner = body.startsWith('[') && body.endsWith(']') ? body.slice(1, -1) : body
  const members = splitTop(inner, /,/).map((member) => {
    if (member.startsWith('<') && member.endsWith('>')) {
      const [first, ...rest] = member.slice(1, -1).trim().split(/\s+/)
      return { pitch: pitchOf(first ?? '', degree), alternatives: rest.map((p) => pitchOf(p, degree)) }
    }
    return { pitch: pitchOf(member, degree) }
  })
  return { weight, probability, members }
}

function parseVoice(text: string, velocities: string | null, degree: boolean): Omit<Note, 'id'>[] {
  const tokens = splitTop(text.trim(), /\s/).map((t) => parseNoteToken(t, degree))
  const total = tokens.reduce((sum, t) => sum + t.weight, 0)
  if (total === 0 || STEPS_PER_CYCLE % total !== 0) fail('The notes do not fit the 16-step grid')
  const unit = STEPS_PER_CYCLE / total
  const velocityTokens = velocities === null ? null : splitTop(velocities.trim(), /\s/)
  if (velocityTokens && velocityTokens.length !== tokens.length) fail('Velocities do not line up with the notes')

  const notes: Omit<Note, 'id'>[] = []
  let step = 0
  tokens.forEach((token, i) => {
    const velocity = velocityTokens ? Number(WEIGHTED.exec(velocityTokens[i] ?? '')?.[1]) : 1
    for (const member of token.members ?? []) {
      if (!Number.isFinite(velocity)) fail('Unexpected velocity')
      notes.push({
        step,
        length: token.weight * unit,
        pitch: member.pitch,
        velocity,
        probability: token.probability,
        ...(member.alternatives?.length ? { alternatives: member.alternatives } : {}),
      })
    }
    step += token.weight * unit
  })
  return notes
}

function parseNotesBase(base: Expression, calls: ChainCall[], degree: boolean): Omit<Note, 'id'>[] {
  const fn = degree ? 'n' : 'note'
  const call = baseCall(base, [fn, 'stack'])
  if (calleeName(call) === fn) {
    const velocity = calls[0]?.name === 'velocity' ? stringOf(calls.shift()?.args[0]) : null
    const voices = splitTop(stringOf(call.arguments[0]), /,/)
    if (velocity !== null && voices.length > 1) fail('Velocities of several voices need stack()')
    return voices.flatMap((voice) => parseVoice(voice, velocity, degree))
  }
  return call.arguments.flatMap((arg) => {
    const { base: voiceBase, calls: voiceCalls } = flattenChain(arg)
    const text = stringOf(baseCall(voiceBase, [fn]).arguments[0])
    if (voiceCalls.length > 1 || (voiceCalls[0] && voiceCalls[0].name !== 'velocity'))
      fail('Unexpected call in a voice')
    return parseVoice(text, voiceCalls[0] ? stringOf(voiceCalls[0].args[0]) : null, degree)
  })
}

/** Keeps the ids of notes that did not move, so the piano roll keeps its selection. */
function withNoteIds(notes: Omit<Note, 'id'>[], previous: readonly Note[], newIdFn: IdFactory): Note[] {
  const pool = new Map<string, string[]>()
  for (const note of previous) {
    const key = `${String(note.step)}|${String(note.pitch)}`
    pool.set(key, [...(pool.get(key) ?? []), note.id])
  }
  return notes.map((note) => ({
    ...note,
    id: pool.get(`${String(note.step)}|${String(note.pitch)}`)?.shift() ?? newIdFn(),
  }))
}

// ---- whole block --------------------------------------------------------------------------

const LABEL = /^\s*(_?)\$:\s?/

/** Parses the block of a step or note track. `previous` gives the identity, kind and names. */
export function parseTrackBlock(text: string, previous: Track, newIdFn: IdFactory = newId): ParseResult {
  try {
    const label = LABEL.exec(text)
    if (!label) fail('A track starts with $:')
    const body = text.slice(label[0].length).trimEnd()
    const expression = parseExpressionAt(body, 0, { ecmaVersion: 2022 })
    if (expression.end !== body.length) fail('Unexpected code after the pattern')
    const { base, calls } = flattenChain(expression)

    const orbitCall = calls.pop()
    if (orbitCall?.name !== 'orbit') fail('A track ends with .orbit(n)')
    const orbit = numberOf(orbitCall.args[0])

    const track: Track = structuredClone(previous)
    track.orbit = orbit
    if (previous.kind === 'steps') {
      track.steps = { stepsPerCycle: STEPS_PER_CYCLE, rows: parseStepsBase(base, previous, newIdFn) }
    } else if (previous.kind === 'notes' && previous.notes) {
      const degree = previous.notes.mode === 'degree'
      const notes = parseNotesBase(base, calls, degree)
      let scale = previous.notes.scale
      if (degree) {
        const scaleCall = calls.shift()
        if (scaleCall?.name !== 'scale') fail('Degree mode needs .scale()')
        scale = stringOf(scaleCall.args[0])
        if (!SCALE_NAME.test(scale)) fail('Unexpected scale')
      }
      track.notes = {
        mode: previous.notes.mode,
        stepsPerCycle: STEPS_PER_CYCLE,
        ...(scale !== undefined ? { scale } : {}),
        notes: withNoteIds(notes, previous.notes.notes, newIdFn),
      }
    } else {
      fail('Only rhythm and note tracks can be read back')
    }

    // Sound source.
    const sound = calls[0]
    if (sound?.name === 'bank') {
      track.source = { type: 'bank', bank: stringOf(sound.args[0]) }
      calls.shift()
    } else if (sound?.name === 's' && previous.kind === 'notes') {
      const name = stringOf(sound.args[0])
      track.source = { type: previous.source.type === 'bank' ? 'synth' : previous.source.type, name }
      calls.shift()
    }
    const sourceName = track.source.type === 'bank' ? track.source.bank : track.source.name
    if (!SOUND_NAME.test(sourceName)) fail('Unexpected sound name')

    // Parameters, then transforms.
    const params: TrackParams = { gain: 1, pan: 0.5 }
    while (calls[0] && (PARAM_ORDER as readonly string[]).includes(calls[0].name)) {
      const call = calls.shift()
      if (!call) break
      const key = call.name as ParamKey
      if (key === 'vowel') {
        const vowel = stringOf(call.args[0])
        if (!VOWEL.test(vowel)) fail('Unexpected vowel')
        params.vowel = vowel
      } else {
        params[key] = paramValueOf(call.args[0])
      }
    }
    // Bypassed effects are not in the code: keep their values for when they are switched back on.
    for (const key of previous.bypassed ?? []) {
      if (params[key] === undefined && previous.params[key] !== undefined) {
        ;(params as Record<string, unknown>)[key] = previous.params[key]
      }
    }
    track.params = params

    const previousTransforms = [...previous.transforms]
    track.transforms = calls.map((call) => {
      const transform = transformOf(call, body)
      const reuse = previousTransforms.findIndex((t) => t.type === transform.type)
      const id = reuse >= 0 ? (previousTransforms.splice(reuse, 1)[0]?.id ?? newIdFn()) : newIdFn()
      return { id, ...transform }
    })

    return { ok: true, track, muted: label[1] === '_' }
  } catch (error) {
    if (error instanceof ParseError) return { ok: false, reason: error.message }
    if (error instanceof SyntaxError) return { ok: false, reason: error.message }
    throw error
  }
}
