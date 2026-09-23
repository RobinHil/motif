import { describe, expect, it } from 'vitest'
import { isAllowedPermission, isAllowedRequest } from './request-policy'

describe('isAllowedRequest', () => {
  it('allows local schemes', () => {
    expect(isAllowedRequest('file:///app/out/renderer/index.html', null)).toBe(true)
    expect(isAllowedRequest('motif-sample://bundled/test/bd/0.wav', null)).toBe(true)
    expect(isAllowedRequest('data:text/plain,hi', null)).toBe(true)
  })

  it('blocks every remote URL in production', () => {
    expect(
      isAllowedRequest('https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/strudel.json', null),
    ).toBe(false)
    expect(isAllowedRequest('http://localhost:5173/', null)).toBe(false)
    expect(isAllowedRequest('https://fonts.googleapis.com/css', null)).toBe(false)
  })

  it('allows only the dev server origin in development', () => {
    const dev = 'http://localhost:5173'
    expect(isAllowedRequest('http://localhost:5173/src/main.tsx', dev)).toBe(true)
    expect(isAllowedRequest('ws://localhost:5173/', dev)).toBe(true)
    expect(isAllowedRequest('http://localhost:8080/', dev)).toBe(false)
    expect(isAllowedRequest('https://shabda.ndre.gr/speech/hello', dev)).toBe(false)
  })

  it('rejects unparsable URLs', () => {
    expect(isAllowedRequest('not a url', null)).toBe(false)
  })
})

describe('isAllowedPermission', () => {
  it('grants midi only', () => {
    expect(isAllowedPermission('midi')).toBe(true)
    expect(isAllowedPermission('midiSysex')).toBe(false)
    expect(isAllowedPermission('media')).toBe(false)
    expect(isAllowedPermission('geolocation')).toBe(false)
  })
})
