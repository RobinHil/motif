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
  setAudioContext,
  superdough,
  webaudioRepl,
  type Repl,
} from '@strudel/webaudio'
import type { GeneratedCode } from '../codegen/generate'
import { checkBlock } from './check-block'
import { Evaluator, type EvaluationResult } from './evaluator'
import { ensureMasterBus, setMasterSettings } from './master-bus'
import type { MasterValues } from './master-settings'
import { trimRecording } from './export-trim'
import { ensureOrbitTap, orbitOutput, orbitPeaks, peak } from './orbit-taps'
import { startRecording } from './recorder'

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
/** Chosen in the settings: latency applies when the audio starts, the output device at any time. */
let latencyHint: AudioContextLatencyCategory = 'interactive'
let outputDevice: string | null = null
let example: { timer: ReturnType<typeof setTimeout>; wasPlaying: boolean; done: () => void } | null = null

async function boot(): Promise<Repl> {
  setAudioContext(new AudioContext({ latencyHint }))
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
  await applyOutputDevice()
  repl = webaudioRepl({
    transpiler,
    onEvalError: (error) => {
      lastEvalError = error
    },
  })
  return repl
}

type SinkContext = AudioContext & { setSinkId?: (id: string) => Promise<void>; sinkId?: string }

async function applyOutputDevice(): Promise<void> {
  const context = getAudioContext() as SinkContext
  const wanted = outputDevice ?? ''
  if (typeof context.setSinkId !== 'function' || context.sinkId === wanted) return
  try {
    await context.setSinkId(wanted)
  } catch (error) {
    console.warn('[engine] output device unavailable, keeping the default', error)
  }
}

/** Settings of the audio output. The latency is used when the engine starts. */
export async function configureAudio(options: { latency: AudioContextLatencyCategory; output: string | null }) {
  latencyHint = options.latency
  outputDevice = options.output
  if (repl !== null) await applyOutputDevice()
}

/** Sample rate of the running audio, which exports use; null before the engine starts. */
export function outputSampleRate(): number | null {
  return repl === null ? null : getAudioContext().sampleRate
}

/** The audio output's latency in milliseconds, once the engine runs. */
export function outputLatency(): number | null {
  if (repl === null) return null
  const context = getAudioContext()
  return Math.round(((context.baseLatency || 0) + (context.outputLatency || 0)) * 1000)
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
export async function previewSound(value: Record<string, unknown>, seconds = 0.4): Promise<void> {
  await initEngine()
  const context = getAudioContext()
  await context.resume()
  ensureMasterBus()
  await superdough({ ...value, orbit: PREVIEW_ORBIT }, context.currentTime + 0.02, seconds)
}

/** Makes imported sounds playable: `{ breaks: ['breaks/0.wav', ...] }` relative to `baseUrl`. */
export async function registerSamples(map: Record<string, string[]>, baseUrl: string): Promise<void> {
  await initEngine()
  await samples(map, baseUrl)
}

/** Decodes a sample file without playing it (import check, waveform). Rejects if it is not audio. */
export async function decodeSample(url: string): Promise<AudioBuffer> {
  const data = await fetch(url).then((response) => {
    if (!response.ok) throw new Error(`${url}: ${String(response.status)}`)
    return response.arrayBuffer()
  })
  return new OfflineAudioContext(1, 1, 48000).decodeAudioData(data)
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

export interface RenderedAudio {
  sampleRate: number
  master: Float32Array[]
  /** One recording per orbit, before the master bus (SPIKE 2). */
  stems: Map<number, Float32Array[]>
  /** Frames the recorder missed; above zero the file has a gap. */
  droppedFrames: number
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Real-time export (SPEC 9): plays the current program from cycle 0 for `cycles` cycles while
 * recording the master (and `orbits` for stems), then keeps exactly those cycles. The start is the
 * audio time the scheduler gives cycle 0, so the file starts on the first beat.
 */
export async function renderCycles(
  cycles: number,
  orbits: readonly number[],
  onProgress?: (done: number) => void,
): Promise<RenderedAudio> {
  const instance = await initEngine()
  const context = getAudioContext()
  await context.resume()
  ensureMasterBus()
  if (playing) {
    stop()
    // Let what was playing ring out before recording starts.
    await wait(600)
  }
  await evaluator.flush()
  if (!hasProgram) throw new Error('There is nothing to play yet.')

  const stopMaster = await startRecording()
  const stopStems = await Promise.all(
    orbits.map(async (orbit) => {
      ensureOrbitTap(orbit)
      return [orbit, await startRecording(orbitOutput(orbit))] as const
    }),
  )
  const { scheduler } = instance
  const before = scheduler.seconds_at_cps_change
  // Pre-roll: the scheduler starts half a second before cycle 0, silenced, because its first ticks
  // may be skipped as "too late" while the main thread is busy starting playback.
  const preroll = 0.5 * scheduler.cps
  if (scheduler.pattern) scheduler.pattern = scheduler.pattern.filterWhen((t) => t >= 0)
  scheduler.lastEnd = -preroll
  playing = true
  instance.start()
  try {
    // The first tick after start fixes when cycle 0 sounds.
    for (let i = 0; scheduler.seconds_at_cps_change === before || scheduler.seconds_at_cps_change === undefined; i++) {
      if (i > 200) throw new Error('The scheduler did not start.')
      await wait(10)
    }
    const start =
      (scheduler.seconds_at_cps_change ?? 0) + scheduler.latency - scheduler.num_cycles_at_cps_change / scheduler.cps
    const seconds = cycles / scheduler.cps
    while (context.currentTime < start + seconds + 0.05) {
      onProgress?.(Math.max(0, Math.min(1, (context.currentTime - start) / seconds)))
      await wait(50)
    }
    onProgress?.(1)
    stop()
    const master = await stopMaster()
    const stems = new Map<number, Float32Array[]>()
    let droppedFrames = master.droppedFrames
    for (const [orbit, stopStem] of stopStems) {
      const stem = await stopStem()
      droppedFrames += stem.droppedFrames
      stems.set(orbit, trimRecording(stem, start, seconds))
    }
    return { sampleRate: master.sampleRate, master: trimRecording(master, start, seconds), stems, droppedFrames }
  } catch (error) {
    stop()
    await stopMaster()
    for (const [, stopStem] of stopStems) await stopStem()
    throw error
  }
}

/**
 * Free recording of the output ("Record output"): from now until the returned function is called.
 * `orbits` also records one stem per orbit.
 */
export async function startOutputRecording(orbits: readonly number[]): Promise<() => Promise<RenderedAudio>> {
  await initEngine()
  await getAudioContext().resume()
  ensureMasterBus()
  const stopMaster = await startRecording()
  const stopStems = await Promise.all(
    orbits.map(async (orbit) => {
      ensureOrbitTap(orbit)
      return [orbit, await startRecording(orbitOutput(orbit))] as const
    }),
  )
  return async () => {
    const master = await stopMaster()
    const stems = new Map<number, Float32Array[]>()
    let droppedFrames = master.droppedFrames
    // Stems start on the master's first frame, so all files line up.
    const start = master.startFrame / master.sampleRate
    const seconds = (master.channels[0]?.length ?? 0) / master.sampleRate
    for (const [orbit, stopStem] of stopStems) {
      const stem = await stopStem()
      droppedFrames += stem.droppedFrames
      stems.set(orbit, trimRecording(stem, start, seconds))
    }
    return { sampleRate: master.sampleRate, master: master.channels, stems, droppedFrames }
  }
}
