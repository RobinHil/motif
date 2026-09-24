// Test helper: evaluates generated code with the real Strudel packages, without audio.
// The repl needs a browser, so `$:` blocks are registered the way the repl does it
// (see engine/strudel-locations.test.ts).
import { evalScope, evaluate, Pattern, stack } from '@strudel/core'
import { transpiler } from '@strudel/transpiler'

export interface PlayedEvent {
  begin: number
  value: Record<string, unknown>
}

let ready: Promise<void> | null = null
let registered: Pattern[] = []

/** Sets up Strudel's global scope once (what the engine does at boot, minus audio). */
export function initStrudelScope(): Promise<void> {
  ready ??= (async () => {
    await evalScope(
      import('@strudel/core'),
      import('@strudel/mini'),
      import('@strudel/tonal'),
      // The webaudio package needs a browser; these calls only matter for sound.
      { setcpm: () => undefined, setcps: () => undefined },
    )
    Pattern.prototype.p = function (this: Pattern, id: string) {
      if (!id.startsWith('_')) registered.push(this)
      return this
    }
  })()
  return ready
}

/** Evaluates `code` and returns the events with an onset in [begin, end), sorted. */
export async function playedEvents(code: string, begin = 0, end = 1): Promise<PlayedEvent[]> {
  await initStrudelScope()
  registered = []
  const { pattern } = await evaluate(code, transpiler)
  // Code with `$:` blocks registers patterns; a bare expression returns one.
  const played = registered.length > 0 ? stack(...registered) : pattern
  const haps = played.queryArc(begin, end) as unknown as {
    whole?: { begin: { valueOf(): number } }
    value: Record<string, unknown>
    hasOnset(): boolean
  }[]
  return haps
    .filter((h) => h.hasOnset())
    .map((h) => ({ begin: Number((h.whole?.begin.valueOf() ?? 0).toFixed(4)), value: h.value }))
    .sort((a, b) => a.begin - b.begin || JSON.stringify(a.value).localeCompare(JSON.stringify(b.value)))
}
