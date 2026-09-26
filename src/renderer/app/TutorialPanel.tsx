import { useState } from 'react'
import { useProject } from '../store/project-store'
import { useTransport } from '../store/transport-store'
import { useTutorial } from '../store/tutorial-store'
import { TUTORIAL_STEPS } from '../tutorial/steps'
import { togglePlay } from './transport'
import { doCurrentStep, finishTutorial, goToStep, quitTutorial } from './tutorial-session'

const button =
  'h-8 rounded-pill border border-line-strong px-3.5 text-body text-text hover:bg-raised disabled:opacity-40'
const primary =
  'h-8 rounded-pill bg-accent px-4 text-body font-medium text-bg-app hover:bg-accent-hover disabled:opacity-40'

/** The tutorial, step by step, in a corner of the window (welcome banner). */
export function TutorialPanel() {
  const active = useTutorial((s) => s.active)
  const index = useTutorial((s) => s.step)
  const step = TUTORIAL_STEPS[index]
  const done = useProject((s) => (step ? step.done(s.project) : true))
  const playing = useTransport((s) => s.playing)
  const [folded, setFolded] = useState(false)
  if (!active) return null

  const counter = `Step ${String(Math.min(index + 1, TUTORIAL_STEPS.length))} of ${String(TUTORIAL_STEPS.length)}`
  if (folded)
    return (
      <button
        type="button"
        onClick={() => setFolded(false)}
        className="fixed right-5 bottom-5 z-40 h-10 rounded-pill border border-accent bg-panel px-4 text-body text-text shadow-lg"
      >
        Tutorial, {counter.toLowerCase()}
      </button>
    )

  return (
    <section
      aria-label="Tutorial"
      className="fixed right-5 bottom-5 z-40 flex w-[380px] flex-col gap-3 rounded-panel border border-accent bg-panel p-5 text-text shadow-lg"
    >
      <header className="flex items-center gap-2">
        <span className="text-section font-medium uppercase tracking-[0.14em] text-label">
          Tutorial · {step ? counter : 'Done'}
        </span>
        <button
          type="button"
          onClick={() => setFolded(true)}
          className="ml-auto text-small text-text-2 hover:text-text"
        >
          Fold
        </button>
        <button type="button" onClick={quitTutorial} className="text-small text-text-2 hover:text-text">
          Quit
        </button>
      </header>
      {step ? (
        <>
          <h2 className="text-track-name font-medium">{step.title}</h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-4 text-body text-text-2">
            {step.instructions.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <code className="rounded-input bg-bg-code px-3 py-2 font-mono text-knob-value break-all text-text-2">
            {step.code}
          </code>
          <p role="status" className={`text-body ${done ? 'text-success' : 'text-text-2'}`}>
            {done ? 'Done. On to the next step.' : 'Waiting for you, or let Motif do it.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={index === 0} onClick={() => goToStep(index - 1)} className={button}>
              Back
            </button>
            <button type="button" onClick={() => goToStep(index)} className={button}>
              Show me
            </button>
            <button type="button" disabled={done} onClick={doCurrentStep} className={button}>
              Do it for me
            </button>
            <button type="button" disabled={!done} onClick={() => goToStep(index + 1)} className={`ml-auto ${primary}`}>
              Next
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-track-name font-medium">Your track is ready</h2>
          <p className="text-body text-text-2">
            Song mode plays it from the intro to the industrial ending, about two minutes. Change anything: every knob,
            note and scene rewrites the code. Save it with Ctrl+S.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => goToStep(TUTORIAL_STEPS.length - 1)} className={button}>
              Back
            </button>
            <button
              type="button"
              onClick={() =>
                void finishTutorial().then(() => {
                  if (!playing) void togglePlay()
                })
              }
              className={`ml-auto ${primary}`}
            >
              Play the song
            </button>
          </div>
        </>
      )}
    </section>
  )
}
