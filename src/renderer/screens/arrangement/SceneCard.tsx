import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { startScene } from '../../app/live-scenes'
import { ContextMenu, type MenuPosition } from '../../components/ContextMenu'
import type { Scene } from '../../model/project'
import {
  addSection,
  deleteScene,
  duplicateScene,
  renameScene,
  SCENE_LENGTHS,
  setSceneLength,
  toggleSceneTrack,
} from '../../store/arrangement-actions'
import { projectStore, useProject } from '../../store/project-store'
import { useTransport } from '../../store/transport-store'
import { SWATCH } from '../studio/StudioTrackRow'

export const SCENE_DRAG_TYPE = 'application/x-motif-scene'

/** A scene: name, its tracks as colored dots, length. Live mode: click to start it (SPEC 6.5). */
export function SceneCard({ scene }: { scene: Scene }) {
  const tracks = useProject((s) => s.project.tracks)
  const mode = useTransport((s) => s.arrangeMode)
  const live = useTransport((s) =>
    s.arrangeMode !== 'live'
      ? null
      : s.queued?.sceneId === scene.id
        ? 'next'
        : s.liveScene === scene.id
          ? 'playing'
          : null,
  )
  const [menu, setMenu] = useState<MenuPosition | null>(null)
  const [renaming, setRenaming] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { update } = projectStore.getState()

  useEffect(() => {
    if (renaming) inputRef.current?.select()
  }, [renaming])

  const openMenu = (x: number, y: number) => setMenu({ x, y })
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (mode === 'live') startScene(scene.id)
    } else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault()
      const rect = event.currentTarget.getBoundingClientRect()
      openMenu(rect.left, rect.bottom + 4)
    } else if (event.key === 'F2') setRenaming(true)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={!renaming}
      aria-label={`${scene.name}, ${String(scene.lengthCycles)} cycles${live ? `, ${live}` : ''}`}
      data-scene-card={scene.id}
      data-state={live ?? undefined}
      onDragStart={(event) => {
        event.dataTransfer.setData(SCENE_DRAG_TYPE, scene.id)
        event.dataTransfer.effectAllowed = 'copy'
      }}
      onClick={() => {
        if (mode === 'live') startScene(scene.id)
      }}
      onDoubleClick={() => setRenaming(true)}
      onContextMenu={(event) => {
        event.preventDefault()
        openMenu(event.clientX, event.clientY)
      }}
      onKeyDown={onKeyDown}
      className="group relative flex h-[132px] w-full cursor-pointer flex-col gap-3 rounded-panel border border-line bg-panel px-4 py-3.5 text-left outline-none hover:border-line-strong focus-visible:border-text-2 data-[state=next]:border-track-3 data-[state=playing]:border-accent data-[state=playing]:bg-raised"
    >
      <div className="flex items-start justify-between gap-2">
        {renaming ? (
          <input
            ref={inputRef}
            aria-label="Scene name"
            defaultValue={scene.name}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              event.stopPropagation()
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') setRenaming(false)
            }}
            onBlur={(event) => {
              update(renameScene(scene.id, event.target.value))
              setRenaming(false)
            }}
            className="w-full rounded-xs bg-bg-code px-1 text-track-name outline-none"
          />
        ) : (
          <span className="truncate text-track-name font-medium">{scene.name}</span>
        )}
        <span className="text-small text-accent group-data-[state=playing]:inline hidden">playing</span>
        <span className="text-small text-track-3 group-data-[state=next]:inline hidden">next</span>
      </div>
      <div role="group" aria-label={`Tracks in ${scene.name}`} className="flex flex-wrap gap-1.5">
        {tracks.map((track) => {
          const active = scene.activeTrackIds.includes(track.id)
          return (
            <button
              key={track.id}
              type="button"
              aria-pressed={active}
              aria-label={`${track.name} in ${scene.name}`}
              title={`${active ? 'Remove' : 'Add'} ${track.name}`}
              onClick={(event) => {
                event.stopPropagation()
                update(toggleSceneTrack(scene.id, track.id))
              }}
              className={`h-2.5 w-7 rounded-xs ${active ? SWATCH[track.color] : 'bg-active hover:bg-line-strong'}`}
            />
          )
        })}
      </div>
      <span className="mt-auto font-mono text-small text-text-2">{scene.lengthCycles} cycles</span>
      {menu && (
        <ContextMenu
          label={`${scene.name} menu`}
          position={menu}
          onClose={() => setMenu(null)}
          items={[
            { label: 'Add to the end of the song', onSelect: () => update(addSection(scene.id)) },
            { label: 'Rename', onSelect: () => setRenaming(true) },
            ...SCENE_LENGTHS.map((length) => ({
              label: `Length: ${String(length)} cycles`,
              disabled: scene.lengthCycles === length,
              onSelect: () => update(setSceneLength(scene.id, length)),
            })),
            { label: 'Duplicate', onSelect: () => update(duplicateScene(scene.id)) },
            { label: 'Delete', onSelect: () => update(deleteScene(scene.id)) },
          ]}
        />
      )}
    </div>
  )
}
