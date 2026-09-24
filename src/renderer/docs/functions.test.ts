import { evalScope, Pattern } from '@strudel/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { initStrudelScope, playedEvents } from '../codegen/strudel-harness'
import { FUNCTIONS, functionDoc } from './functions'

/** Injected by the Strudel repl at runtime, so absent from a plain scope. */
const REPL_FUNCTIONS = new Set(['setcpm', 'setcps'])

beforeAll(async () => {
  await initStrudelScope()
  await evalScope(import('@strudel/tonal'))
})

describe('in-app function reference', () => {
  it('documents 60 functions with unique names and valid links', () => {
    expect(FUNCTIONS).toHaveLength(60)
    expect(new Set(FUNCTIONS.map((f) => f.name)).size).toBe(60)
    for (const doc of FUNCTIONS) {
      expect(doc.signature.startsWith(doc.name), doc.name).toBe(true)
      expect(doc.description.length, doc.name).toBeGreaterThan(20)
      expect(doc.short.length, doc.name).toBeGreaterThan(2)
      for (const other of doc.seeAlso) expect(functionDoc(other), `${doc.name} -> ${other}`).toBeDefined()
    }
  })

  it('only documents functions that exist in the installed Strudel', () => {
    const scope = globalThis as unknown as Record<string, unknown>
    const proto = Pattern.prototype as unknown as Record<string, unknown>
    const missing = FUNCTIONS.map((f) => f.name).filter(
      (name) => !REPL_FUNCTIONS.has(name) && scope[name] === undefined && typeof proto[name] !== 'function',
    )
    expect(missing).toEqual([])
  })

  it.each(FUNCTIONS.map((f) => [f.name, f.example] as const))('has a playable example for %s', async (_name, example) => {
    const events = await playedEvents(example, 0, 2)
    expect(events.length).toBeGreaterThan(0)
  })

  it('uses only sounds bundled with the app in examples', () => {
    const bundled = new Set(['bd', 'sd', 'hh', 'cp', 'rim', 'wind', 'sawtooth', 'square', 'triangle', 'sine'])
    for (const doc of FUNCTIONS) {
      for (const [, names] of doc.example.matchAll(/\bs\("([^"]+)"\)/g)) {
        for (const word of (names ?? '').split(/[\s*<>[\],~]+/).filter((w) => /^[a-z]/.test(w))) {
          expect(bundled.has(word), `${doc.name}: ${word}`).toBe(true)
        }
      }
    }
  })
})
