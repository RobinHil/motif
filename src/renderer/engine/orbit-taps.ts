import { getAudioContext, getSuperdoughAudioController } from '@strudel/webaudio'

// Each superdough orbit sums its voices and its own reverb and delay into `Orbit.output`, which then
// goes to the master. Analysers are attached in parallel to that node, so the audible path is untouched.

interface OrbitTap {
  source: GainNode
  analyser: AnalyserNode
}

const taps = new Map<number, OrbitTap>()
let tapsContext: AudioContext | null = null

/**
 * Returns the analyser of an orbit, creating the orbit if superdough has not yet.
 * Idempotent: re-attaches when superdough recreated its orbit nodes (controller reset).
 */
export function ensureOrbitAnalyser(orbit: number): AnalyserNode {
  const context = getAudioContext()
  if (tapsContext !== context) {
    taps.clear()
    tapsContext = context
  }
  const source = getSuperdoughAudioController().getOrbit(orbit).output
  let tap = taps.get(orbit)
  if (!tap) {
    tap = { source, analyser: new AnalyserNode(context, { fftSize: 512, smoothingTimeConstant: 0 }) }
    source.connect(tap.analyser)
    taps.set(orbit, tap)
  } else if (tap.source !== source) {
    source.connect(tap.analyser)
    tap.source = source
  }
  return tap.analyser
}

/** Output node of an orbit, for recording stems. */
export function orbitOutput(orbit: number): GainNode {
  return getSuperdoughAudioController().getOrbit(orbit).output
}

const levelBuffer = new Float32Array(512)

/** Peak absolute sample of an orbit over the analyser window (0 when silent). For meters. */
export function orbitPeak(orbit: number): number {
  const analyser = ensureOrbitAnalyser(orbit)
  analyser.getFloatTimeDomainData(levelBuffer)
  let peak = 0
  for (const sample of levelBuffer) peak = Math.max(peak, Math.abs(sample))
  return peak
}
