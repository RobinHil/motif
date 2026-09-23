import type { MotifApi } from '@shared/ipc'

declare global {
  interface Window {
    readonly motif: MotifApi
  }
}
