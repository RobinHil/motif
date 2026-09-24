// Master bus settings as Web Audio values. Pure, so it can be tested without an AudioContext.

export interface MasterValues {
  gain: number
  compressor: boolean
  limiter: boolean
  width?: number | undefined
  low?: number | undefined
  high?: number | undefined
}

export const MASTER_EQ = { lowFrequency: 200, highFrequency: 4000 }

/**
 * Mid/side width as a 2x2 matrix: L' = same * L + cross * R, R' = same * R + cross * L.
 * Width 1 leaves the signal unchanged, 0 makes it mono, 2 doubles the side signal.
 */
export function widthGains(width: number): { same: number; cross: number } {
  const w = Math.max(0, Math.min(2, width))
  return { same: (1 + w) / 2, cross: (1 - w) / 2 }
}

export interface DynamicsValues {
  threshold: number
  knee: number
  ratio: number
  attack: number
  release: number
}

/** A compressor that does nothing: switching it on or off never reconnects the graph. */
export const NEUTRAL_DYNAMICS: DynamicsValues = { threshold: 0, knee: 0, ratio: 1, attack: 0.003, release: 0.25 }
/** Gentle glue compression. */
export const COMPRESSOR: DynamicsValues = { threshold: -18, knee: 6, ratio: 3, attack: 0.01, release: 0.2 }
/** Brick-wall style limiting just under 0 dBFS. */
export const LIMITER: DynamicsValues = { threshold: -1, knee: 0, ratio: 20, attack: 0.001, release: 0.05 }

export function dynamicsFor(on: boolean, settings: DynamicsValues): DynamicsValues {
  return on ? settings : NEUTRAL_DYNAMICS
}
