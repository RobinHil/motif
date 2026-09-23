import { describe, expect, it } from 'vitest'
import { encodeWav } from './wav'

function readInt24(view: DataView, offset: number): number {
  const value = view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16)
  return value & 0x800000 ? value - 0x1000000 : value
}

describe('encodeWav', () => {
  it('writes a 24-bit stereo header', () => {
    const view = new DataView(encodeWav([new Float32Array(10), new Float32Array(10)], 48000))
    expect(String.fromCharCode(...new Uint8Array(view.buffer, 0, 4))).toBe('RIFF')
    expect(view.getUint16(22, true)).toBe(2)
    expect(view.getUint32(24, true)).toBe(48000)
    expect(view.getUint32(28, true)).toBe(48000 * 6)
    expect(view.getUint16(32, true)).toBe(6)
    expect(view.getUint16(34, true)).toBe(24)
    expect(view.getUint32(40, true)).toBe(60)
    expect(view.byteLength).toBe(44 + 60)
  })

  it('interleaves channels and clamps samples', () => {
    const left = new Float32Array([1, -1, 2])
    const right = new Float32Array([0, 0.5, -2])
    const view = new DataView(encodeWav([left, right], 48000, 24))
    const max = 2 ** 23 - 1
    expect([0, 1, 2, 3, 4, 5].map((i) => readInt24(view, 44 + i * 3))).toEqual([
      max,
      0,
      -max,
      Math.round(0.5 * max),
      max,
      -max,
    ])
  })

  it('supports 16 bit', () => {
    const view = new DataView(encodeWav([new Float32Array([0.5])], 44100, 16))
    expect(view.getUint16(34, true)).toBe(16)
    expect(view.getInt16(44, true)).toBe(Math.round(0.5 * 32767))
  })

  it('rejects channels of different lengths', () => {
    expect(() => encodeWav([new Float32Array(2), new Float32Array(3)], 48000)).toThrow()
  })
})
