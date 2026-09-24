import type { CompletionSource } from '@codemirror/autocomplete'
import { FUNCTIONS } from '../docs/functions'

/** Completes documented Strudel functions, with their category on the right (SPEC 6.6). */
export const strudelCompletions: CompletionSource = (context) => {
  const word = context.matchBefore(/[A-Za-z_$][\w$]*/)
  if (!word || (word.from === word.to && !context.explicit)) return null
  return {
    from: word.from,
    options: FUNCTIONS.map((doc) => ({ label: doc.name, detail: doc.category, type: 'function' })),
    validFor: /^[\w$]*$/,
  }
}
