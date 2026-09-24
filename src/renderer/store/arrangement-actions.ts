// Scenes, song sections and automations (SPEC 6.5). Recipes for ProjectState.update: undoable.
import type { Draft } from 'immer'
import { newId, type IdFactory } from '../model/defaults'
import type { Automation, ID, Project } from '../model/project'
import type { Recipe } from './project-store'

export const SCENE_LENGTHS = [4, 8, 16, 32] as const

const lengthOf = (project: Draft<Project>, block: Draft<Project['arrangement'][number]>) =>
  block.lengthCycles ?? project.scenes.find((s) => s.id === block.sceneId)?.lengthCycles ?? 1

/**
 * Keeps sections in time order without overlaps: a section that starts inside the previous one is
 * pushed to its end, and so on down the song. `first` wins when two sections start together.
 */
function pack(project: Draft<Project>, first?: ID) {
  project.arrangement.sort((a, b) => a.startCycle - b.startCycle || (a.id === first ? -1 : b.id === first ? 1 : 0))
  let end = 0
  for (const block of project.arrangement) {
    block.startCycle = Math.max(block.startCycle, end)
    end = block.startCycle + lengthOf(project, block)
  }
}

/** A scene with the tracks that are heard now (not muted, not silenced by a solo). */
export function captureScene(newIdFn: IdFactory = newId): { id: ID; recipe: Recipe } {
  const id = newIdFn()
  return {
    id,
    recipe: (project) => {
      const anySolo = project.tracks.some((t) => t.solo)
      const heard = project.tracks.filter((t) => !t.mute && (!anySolo || t.solo)).map((t) => t.id)
      let n = project.scenes.length + 1
      while (project.scenes.some((s) => s.name === `Scene ${String(n)}`)) n++
      project.scenes.push({ id, name: `Scene ${String(n)}`, lengthCycles: 8, activeTrackIds: heard })
    },
  }
}

export const renameScene =
  (sceneId: ID, name: string): Recipe =>
  (project) => {
    const scene = project.scenes.find((s) => s.id === sceneId)
    const trimmed = name.trim().slice(0, 100)
    if (scene && trimmed) scene.name = trimmed
  }

export const setSceneLength =
  (sceneId: ID, lengthCycles: number): Recipe =>
  (project) => {
    const scene = project.scenes.find((s) => s.id === sceneId)
    if (!scene) return
    scene.lengthCycles = Math.max(1, Math.min(4096, Math.round(lengthCycles)))
    pack(project)
  }

export const toggleSceneTrack =
  (sceneId: ID, trackId: ID): Recipe =>
  (project) => {
    const scene = project.scenes.find((s) => s.id === sceneId)
    if (!scene) return
    scene.activeTrackIds = scene.activeTrackIds.includes(trackId)
      ? scene.activeTrackIds.filter((id) => id !== trackId)
      : project.tracks.filter((t) => t.id === trackId || scene.activeTrackIds.includes(t.id)).map((t) => t.id)
  }

export function duplicateScene(sceneId: ID, newIdFn: IdFactory = newId): Recipe {
  return (project) => {
    const index = project.scenes.findIndex((s) => s.id === sceneId)
    const scene = project.scenes[index]
    if (!scene) return
    project.scenes.splice(index + 1, 0, { ...structuredClone(scene), id: newIdFn(), name: `${scene.name} copy` })
  }
}

/** Removes a scene and its sections. */
export const deleteScene =
  (sceneId: ID): Recipe =>
  (project) => {
    project.scenes = project.scenes.filter((s) => s.id !== sceneId)
    project.arrangement = project.arrangement.filter((b) => b.sceneId !== sceneId)
  }

/** Adds a section of `sceneId` at `startCycle`, or after the last section. */
export function addSection(sceneId: ID, startCycle?: number, newIdFn: IdFactory = newId): Recipe {
  return (project) => {
    if (!project.scenes.some((s) => s.id === sceneId)) return
    const end = Math.max(0, ...project.arrangement.map((b) => b.startCycle + lengthOf(project, b)))
    const id = newIdFn()
    project.arrangement.push({ id, sceneId, startCycle: Math.max(0, Math.round(startCycle ?? end)) })
    pack(project, id)
  }
}

/**
 * Moves a section. Moving onto a neighbor swaps them: going left into a section takes its place,
 * going right past the start of the next one puts that one first.
 */
export const moveSection =
  (sectionId: ID, startCycle: number): Recipe =>
  (project) => {
    const block = project.arrangement.find((b) => b.id === sectionId)
    if (!block) return
    const old = block.startCycle
    const length = lengthOf(project, block)
    let start = Math.max(0, Math.round(startCycle))
    const others = project.arrangement.filter((b) => b !== block).sort((a, b) => a.startCycle - b.startCycle)
    if (start < old) {
      const covered = others.find(
        (b) => b.startCycle < old && b.startCycle <= start && start < b.startCycle + lengthOf(project, b),
      )
      if (covered) start = covered.startCycle
    } else if (start > old) {
      const next = others.find((b) => b.startCycle >= old + length)
      if (next && start + length > next.startCycle) {
        next.startCycle = old
        start = old + lengthOf(project, next)
      }
    }
    block.startCycle = start
    pack(project, sectionId)
  }

/** Resizes one section; the scene's own length is kept for its other sections. */
export const resizeSection =
  (sectionId: ID, lengthCycles: number): Recipe =>
  (project) => {
    const block = project.arrangement.find((b) => b.id === sectionId)
    if (!block) return
    const length = Math.max(1, Math.min(4096, Math.round(lengthCycles)))
    const sceneLength = project.scenes.find((s) => s.id === block.sceneId)?.lengthCycles
    if (length === sceneLength) delete block.lengthCycles
    else block.lengthCycles = length
    pack(project)
  }

export const removeSection =
  (sectionId: ID): Recipe =>
  (project) => {
    project.arrangement = project.arrangement.filter((b) => b.id !== sectionId)
  }

export function addAutomation(
  target: Automation['target'],
  value: number,
  endCycle: number,
  newIdFn: IdFactory = newId,
): { id: ID; recipe: Recipe } {
  const id = newIdFn()
  return {
    id,
    recipe: (project) => {
      project.automations.push({
        id,
        target: { ...target },
        points: [
          { cycle: 0, value },
          { cycle: Math.max(1, endCycle), value },
        ],
      })
    },
  }
}

export const setAutomationTarget =
  (automationId: ID, target: Automation['target']): Recipe =>
  (project) => {
    const automation = project.automations.find((a) => a.id === automationId)
    if (automation) automation.target = { ...target }
  }

export const removeAutomation =
  (automationId: ID): Recipe =>
  (project) => {
    project.automations = project.automations.filter((a) => a.id !== automationId)
  }

const sortPoints = (automation: Draft<Automation>) => automation.points.sort((a, b) => a.cycle - b.cycle)

/** Adds a point, or moves the one already on that cycle. */
export const setPoint =
  (automationId: ID, cycle: number, value: number): Recipe =>
  (project) => {
    const automation = project.automations.find((a) => a.id === automationId)
    if (!automation) return
    const at = Math.max(0, Math.round(cycle))
    const existing = automation.points.find((p) => p.cycle === at)
    if (existing) existing.value = value
    else automation.points.push({ cycle: at, value })
    sortPoints(automation)
  }

/** Moves point `index` to another cycle and value; it cannot pass its neighbors. */
export const movePoint =
  (automationId: ID, index: number, cycle: number, value: number): Recipe =>
  (project) => {
    const automation = project.automations.find((a) => a.id === automationId)
    const point = automation?.points[index]
    if (!automation || !point) return
    const before = automation.points[index - 1]?.cycle ?? 0
    const after = automation.points[index + 1]?.cycle ?? Number.POSITIVE_INFINITY
    point.cycle = Math.min(after, Math.max(before, Math.round(cycle)))
    point.value = value
  }

export const removePoint =
  (automationId: ID, index: number): Recipe =>
  (project) => {
    const automation = project.automations.find((a) => a.id === automationId)
    if (automation && automation.points.length > 1) automation.points.splice(index, 1)
  }
