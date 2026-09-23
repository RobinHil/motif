// Guards the Strudel behavior that live highlighting and `lineMap` rely on (docs/DECISIONS.md,
// "Live highlighting"). If a Strudel upgrade breaks one of these, highlighting must be revisited.
import { evalScope, evaluate as strudelEvaluate, Pattern, stack } from '@strudel/core'
import { transpiler } from '@strudel/transpiler'
import { beforeAll, describe, expect, it } from 'vitest'

const STEP_TRACK = `$: s(\`bd ~  ~  ~  bd ~  ~  ~ ,
      ~  ~  sd ~  ~  ~  sd ~ \`).orbit(1)`
const NOTE_TRACK = `$: note("c3 [e3,g3] <a3 b3>").s("sawtooth").orbit(2)`
const CODE = `setcpm(120/4)\n\n${STEP_TRACK}\n${NOTE_TRACK}`

const slice = ([start, end]: [number, number]) => CODE.slice(start, end)

// The repl needs a browser (kabelsalat), so this mirrors what it does for `$:` blocks:
// the transpiler turns `$: x` into `x.p('$')`, and the repl stacks every pattern registered that way.
let registered: Pattern[] = []

async function evaluate(code: string): Promise<Pattern> {
  registered = []
  await strudelEvaluate(code, transpiler)
  return stack(...registered)
}

beforeAll(async () => {
  await evalScope(import('@strudel/core'), import('@strudel/mini'), { setcpm: () => undefined })
  Pattern.prototype.p = function (this: Pattern, id: string) {
    if (!id.startsWith('_')) registered.push(this)
    return this
  }
})

describe('transpiler miniLocations', () => {
  const { miniLocations = [] } = transpiler(CODE)

  it('are absolute offsets into the original code, including the setcpm prefix', () => {
    const tokens = miniLocations.map(slice)
    expect(tokens.filter((t) => t === '~')).toHaveLength(12)
    expect(tokens.filter((t) => t !== '~')).toEqual(['bd', 'bd', 'sd', 'sd', 'c3', 'e3', 'g3', 'a3', 'b3', 'sawtooth'])
  })

  it('handle multi-line backtick strings: the second row maps to the second line', () => {
    const secondRowStart = CODE.indexOf('\n      ~') + 1
    const sdLocations = miniLocations.filter((l) => slice(l) === 'sd')
    expect(sdLocations.every(([start]) => start > secondRowStart)).toBe(true)
  })
})

describe('played haps', () => {
  it('carry the source locations of the tokens that produced them', async () => {
    const pattern = await evaluate(CODE)
    const haps = pattern.queryArc(0, 2).filter((h) => h.hasOnset())
    const tokens = new Set(
      haps.flatMap((h) => (h.context.locations ?? []).map(({ start, end }) => CODE.slice(start, end))),
    )
    expect([...tokens].sort()).toEqual(['a3', 'b3', 'bd', 'c3', 'e3', 'g3', 'sawtooth', 'sd'])
  })

  it('can be attributed to a track by comparing offsets to the track block range', async () => {
    const pattern = await evaluate(CODE)
    const stepRange = { from: CODE.indexOf(STEP_TRACK), to: CODE.indexOf(STEP_TRACK) + STEP_TRACK.length }
    const haps = pattern.queryArc(0, 1).filter((h) => h.hasOnset())
    const drumHaps = haps.filter((h) =>
      (h.context.locations ?? []).some(({ start }) => start >= stepRange.from && start < stepRange.to),
    )
    expect(drumHaps).toHaveLength(4)
  })
})
