// Strudel packages ship no type declarations. These cover only what the engine uses,
// checked against the installed sources (@strudel/core 1.2.6, @strudel/webaudio 1.3.0, superdough 1.3.0).

declare module '@strudel/core' {
  export function evalScope(...modules: unknown[]): Promise<unknown[]>
}

declare module '@strudel/mini' {
  export function miniAllStrings(): void
}

declare module '@strudel/transpiler' {
  export interface TranspilerResult {
    output: string
    miniLocations?: [number, number][]
  }
  export function transpiler(input: string, options?: Record<string, unknown>): TranspilerResult
}

declare module '@strudel/webaudio' {
  export interface ReplState {
    started: boolean
    evalError: unknown
    miniLocations: [number, number][]
  }

  export interface Scheduler {
    now(): number
    started: boolean
  }

  export interface Repl {
    evaluate(code: string, autostart?: boolean, shouldHush?: boolean): Promise<unknown>
    start(): void
    stop(): void
    scheduler: Scheduler
    state: ReplState
  }

  export interface ReplOptions {
    transpiler?: (input: string, options?: Record<string, unknown>) => unknown
    onEvalError?: (error: unknown) => void
    onToggle?: (started: boolean) => void
    audioContext?: AudioContext
  }

  /** superdough/superdoughoutput.mjs: one Orbit per orbit number, created on first use. */
  export interface Orbit {
    output: GainNode
  }

  export interface SuperdoughAudioController {
    output: { destinationGain: GainNode | null }
    nodes: Record<number, Orbit>
    getOrbit(orbit: number, channels?: number[]): Orbit
  }

  export function getSuperdoughAudioController(): SuperdoughAudioController
  export function webaudioRepl(options?: ReplOptions): Repl
  export function initAudio(options?: { disableWorklets?: boolean; maxPolyphony?: number }): Promise<void>
  export function getAudioContext(): AudioContext
  export function registerSynthSounds(): void
  export function samples(sampleMap: string | Record<string, unknown>, baseUrl?: string): Promise<void>
}
