import { contextBridge } from 'electron'
import type { MotifApi } from '@shared/ipc'

const api: MotifApi = {
  platform: process.platform,
}

contextBridge.exposeInMainWorld('motif', api)
