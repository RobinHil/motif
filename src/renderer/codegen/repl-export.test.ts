import { describe, expect, it } from 'vitest'
import { APP_VERSION } from '@shared/app-info'
import { createDemoProject } from '../model/demo'
import { generateProjectCode } from './generate'
import { replExportCode, REPL_BANK } from './repl-export'
import { playedEvents } from './strudel-harness'

describe('code-only export', () => {
  it('swaps Motif drum banks, lists Motif-only sounds and stays playable', async () => {
    const { code } = generateProjectCode(createDemoProject(new Date(0)))
    const exported = replExportCode(code, 'Demo', ['wind'])
    expect(exported.split('\n').slice(0, 4)).toEqual([
      `// "Demo", exported from Motif ${APP_VERSION} for the Strudel REPL (strudel.cc)`,
      `// Drums use the ${REPL_BANK} bank instead of Motif's own kit.`,
      '// Sounds only Motif has, to replace or load with samples(): wind',
      '',
    ])
    expect(exported).toContain(`.bank("${REPL_BANK}").orbit(1)`)
    expect(exported).not.toContain('MotifKit')
    expect(exported).toContain('setcpm(120/4)')
    const events = await playedEvents(exported)
    expect(events.find((e) => e.value['orbit'] === 1)?.value['bank']).toBe(REPL_BANK)
  })

  it('keeps a header without notes when nothing needs replacing', () => {
    expect(replExportCode('setcpm(120/4)\n', 'Empty', [])).toBe(
      `// "Empty", exported from Motif ${APP_VERSION} for the Strudel REPL (strudel.cc)\n\nsetcpm(120/4)\n`,
    )
  })
})
