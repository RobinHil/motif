// In-app Strudel reference (SPEC 6.6): resources/docs/functions.en.json, bundled with the app.
import raw from '../../../resources/docs/functions.en.json'

export interface FunctionDoc {
  name: string
  category: string
  signature: string
  /** A few words, used in fix suggestions: "Did you mean lpf (low-pass filter)?" */
  short: string
  description: string
  example: string
  seeAlso: string[]
}

export const FUNCTIONS: readonly FunctionDoc[] = raw

const byName = new Map(FUNCTIONS.map((doc) => [doc.name, doc]))

export function functionDoc(name: string): FunctionDoc | undefined {
  return byName.get(name)
}
