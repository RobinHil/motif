// Play, stop and panic, shared by the transport bar and the keyboard shortcuts.
import { evaluateNow, panic, play, stop } from '../engine/engine'
import { transportStore } from '../store/transport-store'

export async function togglePlay(): Promise<void> {
  if (transportStore.getState().playing) {
    stop()
    transportStore.getState().setPlaying(false)
  } else {
    transportStore.getState().setPlaying(true)
    await play()
  }
}

export function stopPlayback(): void {
  stop()
  transportStore.getState().setPlaying(false)
}

export async function panicAll(): Promise<void> {
  transportStore.getState().setPlaying(false)
  await panic()
}

export async function evaluate(): Promise<void> {
  await evaluateNow()
}
