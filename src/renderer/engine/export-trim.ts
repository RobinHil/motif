// Cutting a real-time recording to exactly the exported cycles (SPEC 9). Pure, no audio.
import type { Recording } from './recorder'

/** A short fade at the very end, so a sound cut by the export's end does not click. */
export const END_FADE_SECONDS = 0.003

/**
 * The part of `recording` from audio time `startSeconds` (cycle 0 as the scheduler heard it) for
 * `seconds`, padded with silence if the recording is short, with a fade over the last 3 ms.
 */
export function trimRecording(recording: Recording, startSeconds: number, seconds: number): Float32Array[] {
  const { sampleRate } = recording
  const length = Math.round(seconds * sampleRate)
  const offset = Math.round(startSeconds * sampleRate) - recording.startFrame
  const fade = Math.min(length, Math.round(END_FADE_SECONDS * sampleRate))
  return recording.channels.map((channel) => {
    const out = new Float32Array(length)
    for (let i = 0; i < length; i++) out[i] = channel[offset + i] ?? 0
    for (let i = 0; i < fade; i++) out[length - 1 - i] = (out[length - 1 - i] ?? 0) * (i / fade)
    return out
  })
}
