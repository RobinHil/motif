import { describe, expect, it } from 'vitest'
import { developmentCsp, PRODUCTION_CSP } from './csp'

describe('Content Security Policy', () => {
  it('denies everything by default in production and names no remote host', () => {
    expect(PRODUCTION_CSP).toContain("default-src 'none'")
    expect(PRODUCTION_CSP).not.toMatch(/https?:/)
    expect(PRODUCTION_CSP).not.toContain("'unsafe-inline'")
  })

  it('does not allow data: scripts', () => {
    const scriptSrc = PRODUCTION_CSP.split('; ').find((d) => d.startsWith('script-src'))
    expect(scriptSrc).toBe("script-src 'self' 'unsafe-eval'")
  })

  it('opens only the dev server origin in development', () => {
    const csp = developmentCsp('http://localhost:5173')
    expect(csp).toContain('ws://localhost:5173')
    expect(csp.match(/https?:\/\/[^\s;]+/g)).toEqual([
      'http://localhost:5173',
      'http://localhost:5173',
      'http://localhost:5173',
    ])
  })
})
