import { describe, expect, it } from 'vitest'
import { trimRecording } from './export-trim'

const recording = (frames: number, startFrame: number) => ({
  channels: [Float32Array.from({ length: frames }, (_, i) => i), Float32Array.from({ length: frames }, (_, i) => -i)],
  sampleRate: 1000,
  startFrame,
  droppedFrames: 0,
})

describe('export trimming', () => {
  it('keeps exactly the exported time, from cycle 0', () => {
    const [left, right] = trimRecording(recording(5000, 2000), 2.5, 1)
    expect(left).toHaveLength(1000)
    expect(left?.[0]).toBe(500)
    expect(right?.[10]).toBe(-510)
  })

  it('fades the last 3 ms out and pads a short recording with silence', () => {
    const [left] = trimRecording(recording(1200, 0), 0.5, 1)
    expect(left?.[699]).toBe(1199)
    expect(left?.[800]).toBe(0)
    const [full] = trimRecording(recording(5000, 0), 0, 1)
    expect(full?.[999]).toBe(0)
    expect(full?.[998]).toBeCloseTo(998 / 3, 3)
    expect(full?.[997]).toBeCloseTo((997 * 2) / 3, 3)
  })
})
