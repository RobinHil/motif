import { getAudioContext, getSuperdoughAudioController } from '@strudel/webaudio'

// Each superdough orbit sums its voices and its own reverb and delay into `Orbit.output`, which then
// goes to the master. Analysers are attached in parallel to that node (SPIKE 2), one per channel for
// stereo meters, so the audible path is untouched.

interface OrbitTap {
  source: GainNode
  split: ChannelSplitterNode
  left: AnalyserNode
  right: AnalyserNode
}

const taps = new Map<number, OrbitTap>()
let tapsContext: AudioContext | null = null

/**
 * Returns the analysers of an orbit, creating the orbit if superdough has not yet.
 * Idempotent: re-attaches when superdough recreated its orbit nodes (controller reset).
 */
export function ensureOrbitTap(orbit: number): OrbitTap {
  const context = getAudioContext()
  if (tapsContext !== context) {
    taps.clear()
    tapsContext = context
  }
  const source = getSuperdoughAudioController().getOrbit(orbit).output
  let tap = taps.get(orbit)
  if (!tap) {
    const split = new ChannelSplitterNode(context, { numberOfOutputs: 2 })
    tap = {
      source,
      split,
      left: new AnalyserNode(context, { fftSize: 512, smoothingTimeConstant: 0 }),
      right: new AnalyserNode(context, { fftSize: 512, smoothingTimeConstant: 0 }),
    }
    source.connect(split)
    split.connect(tap.left, 0)
    split.connect(tap.right, 1)
    taps.set(orbit, tap)
  } else if (tap.source !== source) {
    source.connect(tap.split)
    tap.source = source
  }
  return tap
}

/** Output node of an orbit, for recording stems. */
export function orbitOutput(orbit: number): GainNode {
  return getSuperdoughAudioController().getOrbit(orbit).output
}

const levelBuffer = new Float32Array(512)

/** Peak absolute sample of an analyser window (0 when silent). */
export function peak(analyser: AnalyserNode): number {
  analyser.getFloatTimeDomainData(levelBuffer)
  let max = 0
  for (const sample of levelBuffer) max = Math.max(max, Math.abs(sample))
  return max
}

/** Left and right peaks of an orbit, for meters. */
export function orbitPeaks(orbit: number): [number, number] {
  const tap = ensureOrbitTap(orbit)
  return [peak(tap.left), peak(tap.right)]
}
