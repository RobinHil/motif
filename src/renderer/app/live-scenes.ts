// Live mode (SPEC 6.5): a clicked scene starts on the next cycle. The change is written into the
// played pattern (see playbackProgram), so it lands on the boundary itself; this module only
// picks the cycle and marks the scene as playing once it has started.
import { getCycle, isPlaying } from '../engine/engine'
import type { ID } from '../model/project'
import { projectStore } from '../store/project-store'
import { transportStore } from '../store/transport-store'
import { onFrame } from '../viz/frame-loop'

/**
 * Time needed between the click and the boundary: evaluation (a few tens of ms) plus the
 * scheduler's look-ahead (about 0.1 s), with room to spare.
 */
export const SWITCH_MARGIN_SECONDS = 0.4

/** The first cycle boundary at least `margin` seconds after `cycle`. */
export function nextBoundary(cycle: number, cyclesPerSecond: number, margin = SWITCH_MARGIN_SECONDS): number {
  return Math.floor(cycle + margin * cyclesPerSecond) + 1
}

export function startScene(sceneId: ID): void {
  const transport = transportStore.getState()
  if (!isPlaying()) {
    transport.setLiveScene(sceneId)
    return
  }
  if (transport.queued?.sceneId === sceneId || (transport.queued === null && transport.liveScene === sceneId)) return
  const { bpm, beatsPerCycle } = projectStore.getState().project.transport
  transport.queueScene(sceneId, nextBoundary(getCycle(), bpm / 60 / beatsPerCycle))
}

/** Marks a queued scene as playing once its cycle has started, or at once when playback stops. */
export function startLiveScenes(): () => void {
  return onFrame(() => {
    const { queued, commitQueued } = transportStore.getState()
    if (queued && (!isPlaying() || getCycle() >= queued.atCycle)) commitQueued()
  })
}
