import { describe, expect, it } from 'vitest'
import { playedEvents } from '../../codegen/strudel-harness'
import { SNIPPETS } from './snippets'

describe('snippets', () => {
  it.each(SNIPPETS.map((s) => [s.label, s.code] as const))('%s plays', async (_label, code) => {
    expect((await playedEvents(code, 0, 2)).length).toBeGreaterThan(0)
  })
})
