import { describe, expect, it } from 'vitest'
import pkg from '../../package.json'
import { APP_NAME, APP_VERSION } from './app-info'

describe('app-info', () => {
  it('matches package.json, which packaging tools read', () => {
    expect(APP_VERSION).toBe(pkg.version)
    expect(APP_NAME).toBe(pkg.productName)
  })
})
