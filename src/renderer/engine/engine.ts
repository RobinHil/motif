// The audio engine's public API. It imports nothing from React and never touches UI state
// (golden rule 2): the app subscribes with `onEvaluation` and reads `getCycle()` from its own
// requestAnimationFrame loop.
import { evalScope } from '@strudel/core'
import { miniAllStrings } from '@strudel/mini'
import { transpiler } from '@strudel/transpiler'
import {
  getAudioContext,
  initAudio,
  registerSynthSounds,
  samples,
  superdough,
  webaudioRepl,
  type Repl,
} from '@strudel/webaudio'
import type { GeneratedCode } from '../codegen/generate'
import { checkBlock } from './check-block'
import { Evaluator, type EvaluationResult } from './evaluator'
import { ensureMasterBus, setMasterSettings } from './master-bus'
import type { MasterValues } from './master-settings'
import { orbitPeaks, peak } from './orbit-taps'

export type { EvaluationResult } from './evaluator'

export const BUNDLED_SAMPLES_URL = 'motif-sample://bundled/'

let repl: Repl | null = null
let ready: Promise<Repl> | null = null
let playing = false
let hasProgram = false
let lastEvalError: unknown = null
const listeners = new Set<(result: EvaluationResult) => void>()
/** The program Strudel is playing and its mini-notation positions, for live highlighting. */
let evaluated: { code: string; locations: [number, number][] } | null = null
let lastGenerated: GeneratedCode | null = null
let example: { timer: ReturnType<typeof setTimeout>; wasPlaying: boolean; done: () => void } | null = null

async function boot(): Promise<Repl> {
  miniAllStrings()
  await evalScope(
    import('@strudel/core'),
    import('@strudel/mini'),
    import('@strudel/tonal'),
    import('@strudel/webaudio'),
  )
  registerSynthSounds()
  const manifest: unknown = await fetch(`${BUNDLED_SAMPLES_URL}motif-kit/strudel.json`).then((r) => r.json())
  await samples(manifest as Record<string, unknown>, `${BUNDLED_SAMPLES_URL}motif-kit/`)
  await initAudio()
  repl = webaudioRepl({
    transpiler,
    onEvalError: (error) => {
      lastEvalError = error
    },
  })
  return repl
}

/** Starts Strudel and the audio context. Called lazily by every function that needs them. */
export function initEngine(): Promise<Repl> {
  ready ??= boot()
  return ready
}

const evaluator = new Evaluator(
  {
    async checkBlock(block) {
      await initEngine()
      return checkBlock(block)
    },
    async evaluate(code) {
      const instance = await initEngine()
      lastEvalError = null
      ensureMasterBus()
      // Stopped: set the pattern without starting, so errors still show up while editing.
      await instance.evaluate(code, playing)
      if (lastEvalError === null) {
        hasProgram = true
        evaluated = { code, locations: instance.state.miniLocations }
      }
      return lastEvalError
    },
  },
  (result) => {
    for (const listener of listeners) listener(result)
  },
)

/** Evaluates the generated program after the debounce delay (SPEC 5: about 150 ms). */
export function setProgram(generated: GeneratedCode): void {
  lastGenerated = generated
  evaluator.schedule(generated)
}

/** Evaluates the pending program immediately (Ctrl+Enter, play). */
export function evaluateNow(): Promise<EvaluationResult | null> {
  return evaluator.flush()
}

export function onEvaluation(listener: (result: EvaluationResult) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function play(): Promise<void> {
  const instance = await initEngine()
  await getAudioContext().resume()
  ensureMasterBus()
  playing = true
  await evaluator.flush()
  if (hasProgram) instance.start()
}

export function stop(): void {
  playing = false
  repl?.stop()
}

/** Ctrl+. : stops scheduling and silences the voices already scheduled or still ringing. */
export async function panic(): Promise<void> {
  stop()
  if (ready) await getAudioContext().suspend()
}

export function isPlaying(): boolean {
  return playing
}

/** Current position in cycles, for playheads drawn in a requestAnimationFrame loop. */
export function getCycle(): number {
  return playing && repl ? repl.scheduler.now() : 0
}

/** Master bus settings: gain, EQ, width, compressor, limiter (MasterSettings). */
export function setMaster(values: MasterValues): void {
  setMasterSettings(values)
}

/** Left and right peaks of the master output, for its meter. */
export function masterLevels(): [number, number] {
  if (repl === null) return [0, 0]
  const bus = ensureMasterBus()
  return [peak(bus.left), peak(bus.right)]
}

/** Fills `out` with the master waveform (oscilloscope). */
export function masterWaveform(out: Float32Array<ArrayBuffer>): boolean {
  if (repl === null) return false
  ensureMasterBus().analyser.getFloatTimeDomainData(out)
  return true
}

/** Orbit used for previews, far from any track orbit. */
const PREVIEW_ORBIT = 64

/** One-shot preview from the sound browser: `{ s: 'bd' }`, `{ s: 'sawtooth', note: 'c3' }`. */
export async function previewSound(value: Record<string, unknown>): Promise<void> {
  await initEngine()
  const context = getAudioContext()
  await context.resume()
  ensureMasterBus()
  await superdough({ ...value, orbit: PREVIEW_ORBIT }, context.currentTime + 0.02, 0.4)
}

/** Whether Strudel and the audio context are running (meters read nothing before). */
export function isReady(): boolean {
  return repl !== null
}

/** Peak level of a track's orbit, for meters drawn in a requestAnimationFrame loop. */
export function trackLevel(orbit: number): number {
  return Math.max(...trackLevels(orbit))
}

/** Left and right peaks of a track's orbit, for stereo meters. */
export function trackLevels(orbit: number): [number, number] {
  return repl === null ? [0, 0] : orbitPeaks(orbit)
}

/** The program being played and its mini-notation positions (character offsets into `code`). */
export function evaluatedProgram(): { code: string; locations: [number, number][] } | null {
  return evaluated
}

/**
 * Positions (`start:end`) of the mini-notation elements sounding now. Read every frame by the live
 * highlighting; queries the playing pattern around the scheduler's current cycle.
 */
export function activeLocations(): Set<string> {
  const active = new Set<string>()
  const pattern = repl?.scheduler.pattern
  if (!playing || !repl || !pattern) return active
  const now = repl.scheduler.now()
  for (const hap of pattern.queryArc(now, now + 0.001) as unknown as {
    whole?: { begin: { valueOf(): number }; end: { valueOf(): number } }
    context: { locations?: { start: number; end: number }[] }
  }[]) {
    if (!hap.whole || hap.whole.begin.valueOf() > now || hap.whole.end.valueOf() <= now) continue
    for (const { start, end } of hap.context.locations ?? []) active.add(`${String(start)}:${String(end)}`)
  }
  return active
}

/**
 * Plays a documentation example for a few cycles in place of the project, then puts the project's
 * program back. Resolves when the example is over.
 */
export async function playExample(code: string, cycles = 2): Promise<void> {
  stopExample()
  const instance = await initEngine()
  await getAudioContext().resume()
  ensureMasterBus()
  const wasPlaying = playing
  playing = true
  await instance.evaluate(code, true)
  const seconds = cycles / (instance.scheduler.cps || 0.5)
  await new Promise<void>((resolve) => {
    example = { timer: setTimeout(() => stopExample(), seconds * 1000), wasPlaying, done: resolve }
  })
}

export function stopExample(): void {
  const current = example
  if (!current) return
  example = null
  clearTimeout(current.timer)
  playing = current.wasPlaying
  if (!current.wasPlaying) repl?.stop()
  if (lastGenerated) {
    evaluator.schedule(lastGenerated)
    void evaluator.flush()
  }
  current.done()
}

export function isExamplePlaying(): boolean {
  return example !== null
}

export interface PlayedEvent {
  begin: number
  end: number
  orbit: number
  /** MIDI note number, when the event has a pitch. */
  midi: number | null
}

const NOTE_NUMBER: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }

function midiOf(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return null
  const match = /^([a-gA-G])([#bs]*)(-?\d+)?$/.exec(value)
  if (!match) return null
  let pitch = NOTE_NUMBER[(match[1] ?? 'c').toLowerCase()] ?? 0
  for (const accidental of match[2] ?? '') pitch += accidental === 'b' ? -1 : 1
  return (Number(match[3] ?? '3') + 1) * 12 + pitch
}

/** Events of the playing pattern between two cycles, for the punchcard and piano roll. */
export function eventsBetween(begin: number, end: number): PlayedEvent[] {
  const pattern = repl?.scheduler.pattern
  if (!pattern) return []
  return (
    pattern.queryArc(begin, end) as unknown as {
      whole?: { begin: { valueOf(): number }; end: { valueOf(): number } }
      value: Record<string, unknown>
    }[]
  ).flatMap((hap) =>
    hap.whole
      ? [
          {
            begin: hap.whole.begin.valueOf(),
            end: hap.whole.end.valueOf(),
            orbit: typeof hap.value['orbit'] === 'number' ? hap.value['orbit'] : 1,
            midi: midiOf(hap.value['note']),
          },
        ]
      : [],
  )
}

/** Fills `out` with the master spectrum in dB (analyser of the master bus). */
export function masterSpectrum(out: Float32Array<ArrayBuffer>): boolean {
  if (repl === null) return false
  ensureMasterBus().analyser.getFloatFrequencyData(out)
  return true
}
