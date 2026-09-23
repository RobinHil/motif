import { evalScope } from '@strudel/core'
import { miniAllStrings } from '@strudel/mini'
import { transpiler } from '@strudel/transpiler'
import { getAudioContext, initAudio, registerSynthSounds, samples, webaudioRepl, type Repl } from '@strudel/webaudio'

export const BUNDLED_SAMPLES_URL = 'motif-sample://bundled/'

let repl: Repl | null = null
let ready: Promise<Repl> | null = null

async function boot(): Promise<Repl> {
  miniAllStrings()
  await evalScope(import('@strudel/core'), import('@strudel/mini'), import('@strudel/webaudio'))
  registerSynthSounds()
  const manifest: unknown = await fetch(`${BUNDLED_SAMPLES_URL}test/strudel.json`).then((r) => r.json())
  await samples(manifest as Record<string, unknown>, `${BUNDLED_SAMPLES_URL}test/`)
  await initAudio()
  repl = webaudioRepl({
    transpiler,
    onEvalError: (error) => {
      console.error('[engine] evaluation failed', error)
    },
  })
  return repl
}

/** Starts the audio context and Strudel. Must be called from a user gesture the first time. */
export function initEngine(): Promise<Repl> {
  ready ??= boot()
  return ready
}

export async function play(code: string): Promise<void> {
  const instance = await initEngine()
  await getAudioContext().resume()
  await instance.evaluate(code, true)
}

export function stop(): void {
  repl?.stop()
}

export function isPlaying(): boolean {
  return repl?.scheduler.started ?? false
}
