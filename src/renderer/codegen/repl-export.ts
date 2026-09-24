// Code-only export (SPEC 9): the program as a `.js` file to paste into the online Strudel REPL.
import { APP_NAME, APP_VERSION } from '@shared/app-info'

/** Drum banks bundled with Motif, replaced by a bank the online REPL has, with the same sound names. */
export const MOTIF_BANKS = ['MotifKit', 'MotifTape'] as const
export const REPL_BANK = 'RolandTR909'

/**
 * `code` ready for strudel.cc: Motif's drum banks swapped for RolandTR909, and a header listing the
 * sounds only Motif has (bundled textures and instruments, imported samples), which must be
 * replaced or loaded with `samples()` online.
 */
export function replExportCode(code: string, projectName: string, motifOnlySounds: readonly string[]): string {
  let body = code
  let swapped = false
  for (const bank of MOTIF_BANKS) {
    const call = `.bank("${bank}")`
    if (body.includes(call)) swapped = true
    body = body.split(call).join(`.bank("${REPL_BANK}")`)
  }
  const header = [
    `// "${projectName}", exported from ${APP_NAME} ${APP_VERSION} for the Strudel REPL (strudel.cc)`,
    ...(swapped ? [`// Drums use the ${REPL_BANK} bank instead of ${APP_NAME}'s own kit.`] : []),
    ...(motifOnlySounds.length > 0
      ? [`// Sounds only ${APP_NAME} has, to replace or load with samples(): ${[...motifOnlySounds].sort().join(', ')}`]
      : []),
    '',
  ]
  return `${header.join('\n')}\n${body}`
}
