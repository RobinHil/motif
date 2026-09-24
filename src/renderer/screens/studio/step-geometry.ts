import { STEPS_PER_CYCLE } from '../../model/project'

/** DESIGN.md "StepButton": 30 x 26 px, 8 px gap every 4 steps. */
export const STEP_WIDTH = 30
export const STEP_HEIGHT = 26
export const STEP_GAP = 4
export const GROUP_GAP = 8
export const ROW_GAP = 6

export function stepX(index: number): number {
  return index * (STEP_WIDTH + STEP_GAP) + Math.floor(index / 4) * (GROUP_GAP - STEP_GAP)
}

export const GRID_WIDTH = stepX(STEPS_PER_CYCLE - 1) + STEP_WIDTH

export function rowY(row: number): number {
  return row * (STEP_HEIGHT + ROW_GAP)
}

/** Step playing at `cycle` (fractional cycles), for the playhead. */
export function stepAt(cycle: number): number {
  const phase = cycle - Math.floor(cycle)
  return Math.min(STEPS_PER_CYCLE - 1, Math.floor(phase * STEPS_PER_CYCLE))
}
