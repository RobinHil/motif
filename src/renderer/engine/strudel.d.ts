// Strudel packages ship no type declarations. These cover only what the engine uses,
// checked against the installed sources (@strudel/core 1.2.6, @strudel/webaudio 1.3.0, superdough 1.3.0).

declare module '@strudel/core' {
  export interface Location {
    start: number
    end: number
  }
  export interface Hap {
    context: { locations?: Location[] }
    value: unknown
    hasOnset(): boolean
  }
  export class Pattern {
    queryArc(begin: number, end: number): Hap[]
    p(id: string): Pattern
    range(min: number, max: number): Pattern
    slow(factor: number): Pattern
  }
  export const sine: Pattern
  export const tri: Pattern
  export const saw: Pattern
  export const isaw: Pattern
  export const square: Pattern
  export const perlin: Pattern
  export const rand: Pattern
  export function stack(...patterns: Pattern[]): Pattern
  export function isPattern(value: unknown): value is Pattern
  export function evalScope(...modules: unknown[]): Promise<unknown[]>
  export function evaluate(
    code: string,
    transpiler?: (input: string) => unknown,
  ): Promise<{ pattern: Pattern; meta?: { miniLocations?: [number, number][] } }>
}

declare module '@strudel/tonal' {
  export {}
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
    cps: number
    pattern?: import('@strudel/core').Pattern
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
  /** Plays one event now-ish: `value` holds controls such as s, note, bank, gain. */
  export function superdough(value: Record<string, unknown>, time: number, duration: number): Promise<void>
  export function webaudioRepl(options?: ReplOptions): Repl
  export function initAudio(options?: { disableWorklets?: boolean; maxPolyphony?: number }): Promise<void>
  export function getAudioContext(): AudioContext
  export function registerSynthSounds(): void
  export function samples(sampleMap: string | Record<string, unknown>, baseUrl?: string): Promise<void>
}
