import { app, type Session } from 'electron'
import { developmentCsp } from '@shared/csp'
import { isAllowedPermission, isAllowedRequest } from './request-policy'

export function hardenSession(session: Session, devServerOrigin: string | null): void {
  session.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(isAllowedPermission(permission))
  })
  session.setPermissionCheckHandler((_webContents, permission) => isAllowedPermission(permission))

  session.webRequest.onBeforeRequest((details, callback) => {
    const cancel = !isAllowedRequest(details.url, devServerOrigin)
    if (cancel) console.warn(`[security] blocked request to ${details.url}`)
    callback({ cancel })
  })

  if (devServerOrigin !== null) {
    const csp = developmentCsp(devServerOrigin)
    session.webRequest.onHeadersReceived((details, callback) => {
      callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp] } })
    })
  }
}

export function hardenWebContents(devServerOrigin: string | null): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
    contents.on('will-navigate', (event, url) => {
      if (devServerOrigin === null || !url.startsWith(devServerOrigin)) event.preventDefault()
    })
    contents.on('will-attach-webview', (event) => {
      event.preventDefault()
    })
  })
}
