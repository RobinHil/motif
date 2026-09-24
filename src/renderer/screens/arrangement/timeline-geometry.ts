/** Cycles shown on the timeline: the song plus room to add a section, at least 64, by 4. */
export function visibleCycles(songLength: number): number {
  return Math.max(64, Math.ceil((songLength + 8) / 4) * 4)
}

/** Ruler labels every 4 cycles, fewer when the song is long. */
export function rulerTicks(visible: number): number[] {
  const step = visible <= 128 ? 4 : visible <= 256 ? 8 : 16
  return Array.from({ length: Math.floor(visible / step) }, (_, i) => i * step)
}

export const percent = (cycles: number, visible: number) => `${String((cycles / visible) * 100)}%`

/** Cycle under `clientX` in an element spanning `visible` cycles, rounded to a whole cycle. */
export function cycleAt(clientX: number, rect: { left: number; width: number }, visible: number): number {
  return Math.max(0, Math.round(((clientX - rect.left) / rect.width) * visible))
}
