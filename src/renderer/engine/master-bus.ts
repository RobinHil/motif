import { getAudioContext, getSuperdoughAudioController } from '@strudel/webaudio'

// superdough routes every orbit into `output.destinationGain`, which it connects straight to
// `audioContext.destination`. The master bus is inserted in series between the two:
//   destinationGain -> input -> output -> destination
//                                      -> analyser, recorder taps
// Master processing (gain, compressor, limiter) will live between `input` and `output`.

export interface MasterBus {
  readonly context: AudioContext
  readonly input: GainNode
  readonly output: GainNode
  readonly analyser: AnalyserNode
}

let bus: MasterBus | null = null
let tapped: GainNode | null = null
let masterGain = 0.8

function createBus(context: AudioContext): MasterBus {
  const input = new GainNode(context, { gain: masterGain })
  const output = new GainNode(context)
  const analyser = new AnalyserNode(context, { fftSize: 2048, smoothingTimeConstant: 0.6 })
  input.connect(output)
  output.connect(context.destination)
  output.connect(analyser)
  return { context, input, output, analyser }
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

/** Master volume (MasterSettings.gain). Applied now if the bus exists, otherwise when it is created. */
export function setMasterGain(gain: number): void {
  masterGain = gain
  if (bus) bus.input.gain.setTargetAtTime(gain, bus.context.currentTime, 0.01)
}
