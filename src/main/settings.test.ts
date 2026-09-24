import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, SettingsFile, validSettings } from './settings'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'motif-settings-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('settings', () => {
  it('keeps valid fields and ignores the rest', () => {
    expect(
      validSettings({ zoom: 1.25, latency: 'playback', midiDisabled: ['X', 'X'], language: 'fr', evil: 1 }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      zoom: 1.25,
      latency: 'playback',
      midiDisabled: ['X'],
    })
    expect(validSettings({ zoom: 7, latency: 'fast', audioOutput: 3 })).toEqual(DEFAULT_SETTINGS)
    expect(validSettings('nonsense')).toEqual(DEFAULT_SETTINGS)
  })

  it('reads, updates and persists, surviving a broken file', async () => {
    const file = join(dir, 'settings.json')
    writeFileSync(file, '{ not json')
    const settings = new SettingsFile(file)
    expect(await settings.get()).toEqual(DEFAULT_SETTINGS)
    await settings.update({ audioOutput: 'speakers', zoom: 0.9 })
    expect(await new SettingsFile(file).get()).toMatchObject({ audioOutput: 'speakers', zoom: 0.9 })
  })
})
