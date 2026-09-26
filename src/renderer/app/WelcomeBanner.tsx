import { useSettings } from '../store/settings-store'
import { useTutorial } from '../store/tutorial-store'
import { dismissWelcome, startTutorial } from './tutorial-session'

/** Invitation to the tutorial at the top of the window, until closed with its cross. */
export function WelcomeBanner() {
  const dismissed = useSettings((s) => s.settings?.welcomeDismissed ?? true)
  const touring = useTutorial((s) => s.active)
  if (dismissed || touring) return null
  return (
    <div
      role="region"
      aria-label="Tutorial invitation"
      className="flex items-center gap-4 border-b border-line bg-accent/10 px-6 py-2.5 text-body-lg"
    >
      <span className="font-medium text-accent">New to Motif?</span>
      <span className="text-text">
        Build a heavy tek track step by step: a distorted kick, a rolling psytrance bass, acid, a melodic break and an
        industrial ending. Every step writes Strudel code.
      </span>
      <button
        type="button"
        onClick={() => void startTutorial()}
        className="ml-auto h-8 shrink-0 rounded-pill bg-accent px-4 text-body font-medium text-bg-app hover:bg-accent-hover"
      >
        Start the tutorial
      </button>
      <button
        type="button"
        aria-label="Close the invitation for good"
        title="Close for good. The tutorial stays on the home screen."
        onClick={() => void dismissWelcome()}
        className="grid size-8 shrink-0 place-items-center rounded-pill text-text-2 hover:bg-raised hover:text-text"
      >
        <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3 stroke-current" strokeWidth={1.5}>
          <path d="M2 2 L10 10 M10 2 L2 10" />
        </svg>
      </button>
    </div>
  )
}
