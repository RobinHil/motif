import { useEffect, useMemo, useRef } from 'react'
import { songLength, songSections } from '../../codegen/song'
import { getCycle, isPlaying } from '../../engine/engine'
import { addAutomation, addSection, toggleSceneTrack } from '../../store/arrangement-actions'
import { projectStore, useProject } from '../../store/project-store'
import { transportStore } from '../../store/transport-store'
import { onFrame } from '../../viz/frame-loop'
import { SWATCH } from '../studio/StudioTrackRow'
import { AutomationLane } from './AutomationLane'
import { SCENE_DRAG_TYPE } from './SceneCard'
import { SectionBlock } from './SectionBlock'
import { cycleAt, percent, rulerTicks, visibleCycles } from './timeline-geometry'

/** Width of the label column, in pixels (grid-cols-[200px_1fr]). */
const LABEL_WIDTH = 200

const FILL: Record<string, string> = {
  'track-1': 'bg-track-1',
  'track-2': 'bg-track-2',
  'track-3': 'bg-track-3',
  'track-4': 'bg-track-4',
}

/** Song mode timeline: ruler, sections, one lane per track, automation lanes, playhead (SPEC 6.5). */
export function Timeline() {
  const tracks = useProject((s) => s.project.tracks)
  const scenes = useProject((s) => s.project.scenes)
  const arrangement = useProject((s) => s.project.arrangement)
  const automations = useProject((s) => s.project.automations)
  const sections = useMemo(
    () => songSections({ scenes, arrangement } as Parameters<typeof songSections>[0]),
    [scenes, arrangement],
  )
  const total = sections.length > 0 ? songLength({ scenes, arrangement } as Parameters<typeof songLength>[0]) : 0
  const visible = visibleCycles(total)
  const sectionRow = useRef<HTMLDivElement>(null)
  const playhead = useRef<HTMLDivElement>(null)
  const lanes = useRef<HTMLDivElement>(null)
  const { update } = projectStore.getState()
  const anySolo = tracks.some((t) => t.solo)

  // Song mode, playing: the playhead and the current section move with the scheduler, outside React.
  useEffect(() => {
    let drawn = ''
    return onFrame(() => {
      const line = playhead.current
      const area = lanes.current
      if (!line || !area) return
      const song = transportStore.getState().arrangeMode === 'song' && isPlaying() && total > 0
      const position = song ? getCycle() % total : -1
      const key = position.toFixed(3)
      if (key === drawn) return
      drawn = key
      line.style.display = song ? 'block' : 'none'
      if (song)
        line.style.transform = `translateX(${String((position / visible) * (area.clientWidth - LABEL_WIDTH))}px)`
      for (const node of area.ownerDocument.querySelectorAll<HTMLElement>('[data-section]')) {
        const inside = song && position >= Number(node.dataset['start']) && position < Number(node.dataset['end'])
        node.dataset['playing'] = String(inside)
        if (inside) {
          const sceneId = sections.find((s) => s.id === node.dataset['section'])?.sceneId
          for (const card of area.ownerDocument.querySelectorAll<HTMLElement>('[data-scene-card]'))
            if (transportStore.getState().arrangeMode === 'song')
              card.dataset['state'] = card.dataset['sceneCard'] === sceneId ? 'playing' : ''
        }
      }
    })
  }, [sections, total, visible])

  const sceneName = (id: string) => scenes.find((s) => s.id === id)?.name ?? ''

  return (
    <section aria-label="Timeline" className="rounded-panel border border-line bg-panel">
      <div className="grid grid-cols-[200px_1fr] border-b border-line">
        <span className="px-4 py-3 text-body text-text-2">Timeline</span>
        <div aria-hidden="true" className="relative">
          {rulerTicks(visible).map((tick) => (
            <span
              key={tick}
              className="absolute top-3 -translate-x-1/2 font-mono text-small text-text-2"
              style={{ left: percent(tick, visible) }}
            >
              {tick}
            </span>
          ))}
        </div>
      </div>
      <div ref={lanes} className="relative">
        <div className="grid grid-cols-[200px_1fr] border-b border-line">
          <span className="px-4 py-4 text-body-lg">Sections</span>
          <div
            ref={sectionRow}
            aria-label="Sections. Drop a scene here to add it."
            role="group"
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes(SCENE_DRAG_TYPE)) event.preventDefault()
            }}
            onDrop={(event) => {
              const sceneId = event.dataTransfer.getData(SCENE_DRAG_TYPE)
              if (!sceneId) return
              event.preventDefault()
              update(addSection(sceneId, cycleAt(event.clientX, event.currentTarget.getBoundingClientRect(), visible)))
            }}
            className="relative h-14"
          >
            {sections.map((section) => (
              <SectionBlock
                key={section.id}
                section={section}
                name={sceneName(section.sceneId)}
                visible={visible}
                row={() => sectionRow.current}
              />
            ))}
            {sections.length === 0 && (
              <span className="absolute inset-0 flex items-center px-3 text-body text-text-3">
                Drag a scene here, or right-click a scene and choose "Add to the end of the song".
              </span>
            )}
          </div>
        </div>
        {tracks.map((track) => {
          const heard = !track.mute && (!anySolo || track.solo)
          return (
            <div key={track.id} className="grid grid-cols-[200px_1fr] border-b border-line">
              <span className={`flex items-center gap-2.5 px-4 py-3 text-body-lg ${heard ? '' : 'text-text-3'}`}>
                <span className={`size-3 rounded-xs ${SWATCH[track.color]}`} />
                {track.name}
                {!heard && <span className="text-small">muted</span>}
              </span>
              <div className="relative h-13">
                {sections.map((section) => {
                  const scene = scenes.find((s) => s.id === section.sceneId)
                  const active = scene?.activeTrackIds.includes(track.id) ?? false
                  return (
                    <button
                      key={section.id}
                      type="button"
                      aria-pressed={active}
                      aria-label={`${track.name} in ${scene?.name ?? ''}, cycles ${String(section.start)} to ${String(section.start + section.length)}`}
                      title={`${active ? 'Remove' : 'Add'} ${track.name} ${active ? 'from' : 'to'} ${scene?.name ?? ''} (every section of this scene)`}
                      onClick={() => update(toggleSceneTrack(section.sceneId, track.id))}
                      className={`absolute top-1.5 bottom-1.5 rounded-xs ${active ? `${FILL[track.color] ?? ''} ${heard ? 'opacity-85' : 'opacity-30'} hover:opacity-100` : 'hover:bg-raised'}`}
                      style={{
                        left: percent(section.start, visible),
                        width: `calc(${percent(section.length, visible)} - 4px)`,
                      }}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
        {automations.map((automation) => (
          <AutomationLane key={automation.id} automation={automation} tracks={tracks} visible={visible} />
        ))}
        <div
          ref={playhead}
          aria-hidden="true"
          className="pointer-events-none absolute top-0 bottom-0 left-[200px] hidden w-0.5 bg-text"
        />
      </div>
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => update(addAutomation({ trackId: 'master', param: 'lpf' }, 2000, Math.max(total, 8)).recipe)}
          className="rounded-pill border border-line-strong px-3 py-1 text-body text-text-2 hover:text-text"
        >
          + Add automation
        </button>
        <span className="text-small text-text-3">Automations play in song mode.</span>
      </div>
    </section>
  )
}
