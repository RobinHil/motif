import { describe, expect, it } from 'vitest'
import { decodeMidi } from './midi-input'

describe('MIDI messages', () => {
  it('decodes control changes and notes', () => {
    expect(decodeMidi('pad', [0xb0, 21, 64])).toEqual({
      kind: 'cc',
      device: 'pad',
      channel: 1,
      controller: 21,
      value: 64,
    })
    expect(decodeMidi('pad', [0x93, 60, 100])).toEqual({
      kind: 'noteon',
      device: 'pad',
      channel: 4,
      note: 60,
      velocity: 100,
    })
    expect(decodeMidi('pad', [0x90, 60, 0])).toEqual({ kind: 'noteoff', device: 'pad', channel: 1, note: 60 })
    expect(decodeMidi('pad', [0x80, 60, 0])).toEqual({ kind: 'noteoff', device: 'pad', channel: 1, note: 60 })
    expect(decodeMidi('pad', [0xf8])).toBeNull()
  })
})
