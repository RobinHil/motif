// AudioWorklet that copies its stereo input to the main thread in chunks, with the frame index
// of each chunk so the receiver can check that no block was dropped.

declare const currentFrame: number
declare function registerProcessor(name: string, processor: new () => AudioWorkletProcessor): void
declare class AudioWorkletProcessor {
  readonly port: MessagePort
}

export interface RecorderChunk {
  startFrame: number
  channels: Float32Array[]
}

const CHUNK_FRAMES = 4096

class RecorderProcessor extends AudioWorkletProcessor {
  private recording = false
  private buffers: Float32Array[] = [new Float32Array(CHUNK_FRAMES), new Float32Array(CHUNK_FRAMES)]
  private filled = 0
  private chunkStart = 0

  constructor() {
    super()
    this.port.onmessage = (event: MessageEvent<'start' | 'stop'>) => {
      if (event.data === 'start') {
        this.recording = true
        this.filled = 0
      } else {
        this.flush()
        this.recording = false
        this.port.postMessage('stopped')
      }
    }
  }

  private flush(): void {
    if (this.filled === 0) return
    const chunk: RecorderChunk = {
      startFrame: this.chunkStart,
      channels: this.buffers.map((b) => b.slice(0, this.filled)),
    }
    this.port.postMessage(
      chunk,
      chunk.channels.map((c) => c.buffer as ArrayBuffer),
    )
    this.filled = 0
  }

  process(inputs: Float32Array[][]): boolean {
    if (!this.recording) return true
    const input = inputs[0] ?? []
    const frames = input[0]?.length ?? 128
    if (this.filled === 0) this.chunkStart = currentFrame
    this.buffers.forEach((buffer, channel) => {
      const source = input[channel] ?? input[0]
      if (source) buffer.set(source, this.filled)
      else buffer.fill(0, this.filled, this.filled + frames)
    })
    this.filled += frames
    if (this.filled + frames > CHUNK_FRAMES) this.flush()
    return true
  }
}

registerProcessor('motif-recorder', RecorderProcessor)
