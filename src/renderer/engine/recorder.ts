import recorderUrl from './recorder.worklet.ts?worker&url'
import type { RecorderChunk } from './recorder.worklet'
import { ensureMasterBus } from './master-bus'

export interface Recording {
  channels: Float32Array[]
  sampleRate: number
  /** AudioContext frame of the first recorded sample, to align simultaneous recordings. */
  startFrame: number
  /** Frames missing between chunks. Anything above zero means the recording has a gap. */
  droppedFrames: number
}

let loaded: Promise<void> | null = null

/** Records `source` (the master output by default) until the returned function is called. */
export async function startRecording(source?: AudioNode): Promise<() => Promise<Recording>> {
  const bus = ensureMasterBus()
  const { context } = bus
  const input = source ?? bus.output
  loaded ??= context.audioWorklet.addModule(recorderUrl)
  await loaded

  const node = new AudioWorkletNode(context, 'motif-recorder', {
    numberOfInputs: 1,
    numberOfOutputs: 0,
    channelCount: 2,
    channelCountMode: 'explicit',
  })
  const chunks: RecorderChunk[] = []
  let stopped: (() => void) | null = null
  node.port.onmessage = (event: MessageEvent<RecorderChunk | 'stopped'>) => {
    if (event.data === 'stopped') stopped?.()
    else chunks.push(event.data)
  }
  input.connect(node)
  node.port.postMessage('start')

  return async () => {
    await new Promise<void>((resolve) => {
      stopped = resolve
      node.port.postMessage('stop')
    })
    input.disconnect(node)
    node.port.close()

    const frames = chunks.reduce((sum, c) => sum + (c.channels[0]?.length ?? 0), 0)
    const channels = [new Float32Array(frames), new Float32Array(frames)]
    let offset = 0
    let droppedFrames = 0
    let expectedStart = chunks[0]?.startFrame ?? 0
    for (const chunk of chunks) {
      droppedFrames += Math.max(0, chunk.startFrame - expectedStart)
      const length = chunk.channels[0]?.length ?? 0
      channels.forEach((channel, i) => {
        channel.set(chunk.channels[i] ?? new Float32Array(length), offset)
      })
      offset += length
      expectedStart = chunk.startFrame + length
    }
    return { channels, sampleRate: context.sampleRate, startFrame: chunks[0]?.startFrame ?? 0, droppedFrames }
  }
}
