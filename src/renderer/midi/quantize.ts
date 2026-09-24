import { STEPS_PER_CYCLE } from '../model/project'

/**
 * Where a note played live lands in the 16-step loop: its start rounded to the grid (a note played
 * just before the loop's end lands on step 0), its length rounded too, at least one grid step.
 */
export function quantizeNote(onCycle: number, offCycle: number, grid: number): { step: number; length: number } {
  const position = (((onCycle % 1) + 1) % 1) * STEPS_PER_CYCLE
  const step = (Math.round(position / grid) * grid) % STEPS_PER_CYCLE
  const held = Math.max(0, offCycle - onCycle) * STEPS_PER_CYCLE
  const length = Math.max(grid, Math.round(held / grid) * grid)
  return { step, length: Math.min(length, STEPS_PER_CYCLE - step) }
}
