import type { ReactNode } from 'react'
import lockup from '../../../resources/brand/lockup-horizontal.svg'
import { APP_TAGLINE } from '@shared/app-info'
import { SCREENS, uiStore, useUi, type Screen } from '../store/ui-store'
import { useTransport } from '../store/transport-store'
import { CyclePosition } from './CyclePosition'
import { TempoControl } from './TempoControl'
import { stopPlayback, togglePlay } from './transport'

export const SCREEN_LABELS: Record<Screen, string> = {
  studio: 'Studio',
  mixer: 'Mixer',
  pianoroll: 'Piano roll',
  modulation: 'Modulation',
  arrangement: 'Arrangement',
  code: 'Code',
}

function RoundButton(props: {
  label: string
  onClick?: () => void
  disabled?: boolean
  hint?: string
  primary?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.hint ?? props.label}
      onClick={props.onClick}
      disabled={props.disabled}
      className={`grid size-12 place-items-center rounded-pill transition-colors disabled:cursor-not-allowed ${
        props.primary
          ? 'bg-accent text-bg-app hover:bg-accent-hover'
          : 'bg-raised text-text hover:bg-active disabled:text-text-3'
      }`}
    >
      {props.children}
    </button>
  )
}

/** Top bar of every screen (SPEC 6.0, mockup 1-studio.png). */
export function TransportBar() {
  const playing = useTransport((s) => s.playing)
  const screen = useUi((s) => s.screen)
  const home = useUi((s) => s.home)

  return (
    <header className="flex items-center gap-4 border-b border-line bg-bg-deep px-6 py-3">
      <button
        type="button"
        onClick={() => uiStore.getState().setHome(true)}
        title="Home"
        className="flex items-center gap-3 rounded-control pr-2"
      >
        <img src={lockup} alt="Motif" className="h-6" />
        <span className="text-small text-label">{APP_TAGLINE}</span>
      </button>
      <div className="flex items-center gap-2">
        <RoundButton
          primary
          label={playing ? 'Pause' : 'Play'}
          hint={playing ? 'Stop (Space)' : 'Play (Space)'}
          onClick={() => void togglePlay()}
        >
          {playing ? (
            <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3.5 fill-current">
              <rect x="2" y="1.5" width="3" height="9" rx="1" />
              <rect x="7" y="1.5" width="3" height="9" rx="1" />
            </svg>
          ) : (
            <svg aria-hidden="true" viewBox="0 0 12 12" className="ml-0.5 size-3.5 fill-current">
              <path d="M3 1.5 L10.5 6 L3 10.5 Z" />
            </svg>
          )}
        </RoundButton>
        <RoundButton label="Stop" hint="Stop (hush)" onClick={stopPlayback}>
          <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3 fill-current">
            <rect x="2" y="2" width="8" height="8" rx="1.5" />
          </svg>
        </RoundButton>
        <RoundButton label="Record" disabled hint="Recording arrives with export">
          <span className="size-3 rounded-pill bg-danger" />
        </RoundButton>
        <RoundButton label="Loop" disabled hint="Looping arrives with the arrangement">
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="size-4 fill-none stroke-current"
            strokeWidth={1.6}
            strokeLinecap="round"
          >
            <path d="M3 7 V6 a2.5 2.5 0 0 1 2.5 -2.5 H12 M10 1.5 L12 3.5 L10 5.5 M13 9 V10 a2.5 2.5 0 0 1 -2.5 2.5 H4 M6 14.5 L4 12.5 L6 10.5" />
          </svg>
        </RoundButton>
      </div>
      <TempoControl />
      <CyclePosition />
      <nav aria-label="Screens" className="ml-4 flex items-center gap-1">
        {SCREENS.map((s, index) => (
          <button
            key={s}
            type="button"
            aria-current={!home && screen === s ? 'page' : undefined}
            title={`${SCREEN_LABELS[s]} (${String(index + 1)})`}
            onClick={() => uiStore.getState().setScreen(s)}
            className={`h-10 rounded-pill px-4 text-body-lg transition-colors ${!home && screen === s ? 'bg-pill-active text-text' : 'text-text-2 hover:text-text'}`}
          >
            {SCREEN_LABELS[s]}
          </button>
        ))}
      </nav>
      <span className="ml-auto flex items-center gap-2 text-body text-text-2">
        <span className="size-2 rounded-pill bg-success" />
        Offline · bundled samples
      </span>
      <button
        type="button"
        disabled
        title="Export arrives in a later version"
        className="h-10 rounded-pill border border-line-strong px-5 text-body text-text disabled:cursor-not-allowed disabled:opacity-60"
      >
        Export
      </button>
    </header>
  )
}
