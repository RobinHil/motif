import { describe, expect, it } from 'vitest'
import { GRID_WIDTH, stepAt, stepX } from './step-geometry'

describe('step geometry', () => {
  it('adds the group gap every 4 steps', () => {
    expect([0, 1, 3, 4, 8].map(stepX)).toEqual([0, 34, 102, 140, 280])
    expect(GRID_WIDTH).toBe(stepX(15) + 30)
  })

  it('finds the playing step from a cycle position', () => {
    expect(stepAt(0)).toBe(0)
    expect(stepAt(20.26)).toBe(4)
    expect(stepAt(3.999)).toBe(15)
  })
})
