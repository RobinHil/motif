import { describe, expect, it } from 'vitest'
import { isAudioFile, soundNameFrom, uniqueName } from './samples'

describe('sample names', () => {
  it('turns file and folder names into Strudel sound names', () => {
    expect(soundNameFrom('Kick 01')).toBe('kick_01')
    expect(soundNameFrom('808 Kick')).toBe('s_808_kick')
    expect(soundNameFrom('Café-Brûlé!!')).toBe('cafe_brule')
    expect(soundNameFrom('***')).toBe('sample')
    expect(soundNameFrom('a'.repeat(50))).toHaveLength(32)
  })

  it('never reuses a taken name', () => {
    expect(uniqueName('bd', new Set(['bd', 'bd_2']))).toBe('bd_3')
    expect(uniqueName('breaks', new Set())).toBe('breaks')
  })

  it('accepts the formats Chromium decodes', () => {
    expect(isAudioFile('loop.WAV')).toBe(true)
    expect(isAudioFile('voice.flac')).toBe(true)
    expect(isAudioFile('pad.aiff')).toBe(false)
    expect(isAudioFile('notes.txt')).toBe(false)
    expect(isAudioFile('.wav')).toBe(false)
  })
})
