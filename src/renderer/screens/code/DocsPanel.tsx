import { useState } from 'react'
import { functionDoc } from '../../docs/functions'
import { isExamplePlaying, playExample, stopExample } from '../../engine/engine'
import { codeStore, useCode } from '../../store/code-store'

/** Documentation of the function under the cursor or selected in the completion list (SPEC 6.6). */
export function DocsPanel() {
  const word = useCode((s) => s.focusWord)
  const doc = functionDoc(word) ?? functionDoc('jux')
  const [playing, setPlaying] = useState(false)
  if (!doc) return null

  const toggleExample = async () => {
    if (isExamplePlaying()) {
      stopExample()
      return
    }
    setPlaying(true)
    await playExample(doc.example)
    setPlaying(false)
  }

  return (
    <aside
      aria-labelledby="docs-title"
      className="flex min-h-0 flex-col gap-5 overflow-y-auto border-l border-line bg-panel p-5"
    >
      <h2 id="docs-title" className="text-section font-medium uppercase tracking-[0.14em] text-label">
        Documentation
      </h2>
      <div className="flex flex-col gap-3">
        <h3 className="font-mono text-screen-title text-code-function">{doc.signature}</h3>
        <p className="text-body-lg text-text">{doc.description}</p>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-body text-text-2">Example</span>
        <pre className="overflow-x-auto rounded-input bg-bg-code px-4 py-3 font-mono text-code text-text">
          {doc.example}
        </pre>
        <button
          type="button"
          onClick={() => void toggleExample()}
          className="h-10 rounded-input border border-accent text-body text-accent hover:bg-accent/10"
        >
          {playing ? 'Stop example' : 'Play example'}
        </button>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-body text-text-2">See also</span>
        <div className="flex flex-wrap gap-2">
          {doc.seeAlso.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => codeStore.getState().setFocusWord(name)}
              className="rounded-control bg-raised-2 px-3 py-1 font-mono text-body text-text hover:bg-active"
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-auto rounded-panel bg-raised px-4 py-3 text-body text-text-2">
        Outlined sounds light up in the code as they play: you watch the music being read in real time.
      </p>
    </aside>
  )
}
