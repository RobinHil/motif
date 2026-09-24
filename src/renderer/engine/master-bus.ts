import { getAudioContext, getSuperdoughAudioController } from '@strudel/webaudio'
import {
  COMPRESSOR,
  dynamicsFor,
  LIMITER,
  MASTER_EQ,
  widthGains,
  type DynamicsValues,
  type MasterValues,
} from './master-settings'

// superdough routes every orbit into `output.destinationGain`, which it connects straight to
// `audioContext.destination`. The master bus is inserted in series between the two (SPIKE 1):
//   destinationGain -> input (gain) -> low shelf -> high shelf -> width -> compressor -> limiter
//                   -> output -> destination, analysers, recorder taps
// The graph never changes while playing: settings only move parameters.

export interface MasterBus {
  readonly context: AudioContext
  readonly input: GainNode
  readonly output: GainNode
  readonly analyser: AnalyserNode
  readonly left: AnalyserNode
  readonly right: AnalyserNode
  readonly low: BiquadFilterNode
  readonly high: BiquadFilterNode
  readonly width: { same: GainNode[]; cross: GainNode[] }
  readonly compressor: DynamicsCompressorNode
  readonly limiter: DynamicsCompressorNode
}

let bus: MasterBus | null = null
let tapped: GainNode | null = null
let settings: MasterValues = { gain: 0.8, compressor: false, limiter: false }

function createBus(context: AudioContext): MasterBus {
  const input = new GainNode(context)
  const low = new BiquadFilterNode(context, { type: 'lowshelf', frequency: MASTER_EQ.lowFrequency })
  const high = new BiquadFilterNode(context, { type: 'highshelf', frequency: MASTER_EQ.highFrequency })
  const split = new ChannelSplitterNode(context, { numberOfOutputs: 2 })
  const merge = new ChannelMergerNode(context, { numberOfInputs: 2 })
  // same[0]: L -> L, same[1]: R -> R, cross[0]: R -> L, cross[1]: L -> R
  const same = [new GainNode(context), new GainNode(context)]
  const cross = [new GainNode(context), new GainNode(context)]
  const compressor = new DynamicsCompressorNode(context)
  const limiter = new DynamicsCompressorNode(context)
  const output = new GainNode(context)
  const analyser = new AnalyserNode(context, { fftSize: 2048, smoothingTimeConstant: 0.6 })
  const meterSplit = new ChannelSplitterNode(context, { numberOfOutputs: 2 })
  const left = new AnalyserNode(context, { fftSize: 512, smoothingTimeConstant: 0 })
  const right = new AnalyserNode(context, { fftSize: 512, smoothingTimeConstant: 0 })

  input.connect(low).connect(high).connect(split)
  split.connect(same[0] as GainNode, 0).connect(merge, 0, 0)
  split.connect(cross[0] as GainNode, 1).connect(merge, 0, 0)
  split.connect(same[1] as GainNode, 1).connect(merge, 0, 1)
  split.connect(cross[1] as GainNode, 0).connect(merge, 0, 1)
  merge.connect(compressor).connect(limiter).connect(output)
  output.connect(context.destination)
  output.connect(analyser)
  output.connect(meterSplit)
  meterSplit.connect(left, 0)
  meterSplit.connect(right, 1)

  const created = {
    context,
    input,
    output,
    analyser,
    left,
    right,
    low,
    high,
    width: { same, cross },
    compressor,
    limiter,
  }
  apply(created, settings, true)
  return created
}

function setDynamics(node: DynamicsCompressorNode, values: DynamicsValues, now: number) {
  node.threshold.setValueAtTime(values.threshold, now)
  node.knee.setValueAtTime(values.knee, now)
  node.ratio.setValueAtTime(values.ratio, now)
  node.attack.setValueAtTime(values.attack, now)
  node.release.setValueAtTime(values.release, now)
}

/** Moves parameters smoothly (10 ms) so changes while playing do not click. */
function apply(target: MasterBus, values: MasterValues, immediate = false) {
  const now = target.context.currentTime
  const glide = (param: AudioParam, value: number) => {
    if (immediate) param.value = value
    else param.setTargetAtTime(value, now, 0.01)
  }
  glide(target.input.gain, values.gain)
  glide(target.low.gain, values.low ?? 0)
  glide(target.high.gain, values.high ?? 0)
  const { same, cross } = widthGains(values.width ?? 1)
  for (const node of target.width.same) glide(node.gain, same)
  for (const node of target.width.cross) glide(node.gain, cross)
  setDynamics(target.compressor, dynamicsFor(values.compressor, COMPRESSOR), now)
  setDynamics(target.limiter, dynamicsFor(values.limiter, LIMITER), now)
}

/**
 * Returns the master bus, (re)inserting it after superdough's output if needed.
 * superdough recreates `destinationGain` when its controller is reset (offline render,
 * `resetGlobalEffects()`), so this is idempotent and cheap to call before every use.
 */
export function ensureMasterBus(): MasterBus {
  const context = getAudioContext()
  if (bus?.context !== context) {
    bus = createBus(context)
    tapped = null
  }
  const source = getSuperdoughAudioController().output.destinationGain
  if (source !== null && source !== tapped) {
    source.disconnect()
    source.connect(bus.input)
    tapped = source
  }
  return bus
}

/** Master settings (MasterSettings). Applied now if the bus exists, otherwise when it is created. */
export function setMasterSettings(values: MasterValues): void {
  settings = values
  if (bus) apply(bus, values)
}
