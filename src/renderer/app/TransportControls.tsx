import type { ReactNode } from 'react'
import { APP_NAME, APP_TAGLINE } from '@shared/app-info'
import { panic, play, stop } from '../engine/engine'
import { projectStore, selectCanRedo, selectCanUndo, selectIsDirty, useProject } from '../store/project-store'
import { transportStore, useTransport } from '../store/transport-store'
import { useUi } from '../store/ui-store'
import { CyclePosition } from './CyclePosition'
import { newProject, openProject, saveProject, saveProjectAs } from './project-session'

function Button(props: { onClick: () => void; disabled?: boolean; primary?: boolean; children: ReactNode }) {
  const style = props.primary
    ? 'bg-accent text-bg-app hover:bg-accent-hover'
    : 'border border-line-strong text-text hover:bg-raised'
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={`h-8 rounded-pill px-4 text-body font-medium transition-colors disabled:opacity-40 ${style}`}
    >
      {props.children}
    </button>
  )
}

export function TransportControls() {
  const playing = useTransport((s) => s.playing)
  const canUndo = useProject(selectCanUndo)
  const canRedo = useProject(selectCanRedo)
  const dirty = useProject(selectIsDirty)
  const fileName = useUi((s) => s.fileName)

  const togglePlay = async () => {
    if (playing) {
      stop()
      transportStore.getState().setPlaying(false)
    } else {
      await play()
      transportStore.getState().setPlaying(true)
    }
  }

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-line bg-bg-deep px-5 py-3">
      <div className="mr-4 flex items-baseline gap-2">
        <span className="text-track-name font-medium tracking-tight">
          {APP_NAME.toLowerCase()}
          <span className="text-accent">.</span>
        </span>
        <span className="text-small text-label">{APP_TAGLINE}</span>
      </div>
      <Button primary onClick={() => void togglePlay()}>
        {playing ? 'Stop' : 'Play'}
      </Button>
      <Button
        onClick={() => {
          void panic()
          transportStore.getState().setPlaying(false)
        }}
      >
        Panic
      </Button>
      <CyclePosition />
      <div className="mx-2 h-5 w-px bg-line" />
      <Button
        onClick={() => {
          projectStore.getState().undo()
        }}
        disabled={!canUndo}
      >
        Undo
      </Button>
      <Button
        onClick={() => {
          projectStore.getState().redo()
        }}
        disabled={!canRedo}
      >
        Redo
      </Button>
      <div className="mx-2 h-5 w-px bg-line" />
      <Button onClick={() => void newProject()}>New</Button>
      <Button onClick={() => void openProject()}>Open</Button>
      <Button onClick={() => void saveProject()}>Save</Button>
      <Button onClick={() => void saveProjectAs()}>Save as</Button>
      <span className="text-small text-text-2">
        {fileName ?? 'Unsaved project'}
        {dirty && <span className="text-accent"> (modified)</span>}
      </span>
    </header>
  )
}
