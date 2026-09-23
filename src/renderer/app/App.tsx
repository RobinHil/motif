import { useState } from 'react'
import { APP_NAME, APP_TAGLINE } from '@shared/app-info'
import { play, stop } from '@renderer/engine/engine'

const TEST_PATTERN = `$: s("bd sd hh sd")
$: note("c3 e3 g3").s("sawtooth")`

export function App() {
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    setError(null)
    if (playing) {
      stop()
      setPlaying(false)
      return
    }
    try {
      await play(TEST_PATTERN)
      setPlaying(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 bg-bg-app">
      <div className="flex items-baseline gap-3">
        <h1 className="text-screen-title font-medium tracking-tight">
          {APP_NAME.toLowerCase()}
          <span className="text-accent">.</span>
        </h1>
        <p className="text-small text-label">{APP_TAGLINE}</p>
      </div>
      <button
        type="button"
        onClick={() => void toggle()}
        className="h-9 rounded-pill bg-accent px-5 font-medium text-bg-app transition-colors hover:bg-accent-hover"
      >
        {playing ? 'Stop' : 'Play test pattern'}
      </button>
      <pre className="rounded-input bg-bg-code px-4 py-3 font-mono text-code text-text-2">{TEST_PATTERN}</pre>
      {error !== null && <p className="text-small text-danger">{error}</p>}
    </main>
  )
}
