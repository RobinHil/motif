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
import { ensureMasterBus, setMasterGain as setBusGain } from './master-bus'
import { orbitPeak } from './orbit-taps'

export type { EvaluationResult } from './evaluator'

export const BUNDLED_SAMPLES_URL = 'motif-sample://bundled/'

let repl: Repl | null = null
let ready: Promise<Repl> | null = null
let playing = false
let hasProgram = false
let lastEvalError: unknown = null
const listeners = new Set<(result: EvaluationResult) => void>()

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
      if (lastEvalError === null) hasProgram = true
      return lastEvalError
    },
  },
  (result) => {
    for (const listener of listeners) listener(result)
  },
)

/** Evaluates the generated program after the debounce delay (SPEC 5: about 150 ms). */
export function setProgram(generated: GeneratedCode): void {
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

export function setMasterGain(gain: number): void {
  setBusGain(gain)
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
  return repl === null ? 0 : orbitPeak(orbit)
}
