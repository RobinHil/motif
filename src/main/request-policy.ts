const LOCAL_SCHEMES = new Set(['file:', 'motif-sample:', 'devtools:', 'chrome-extension:', 'data:', 'blob:'])
const ALLOWED_PERMISSIONS = new Set(['midi'])

/** Rule 7: the app never reaches the network. Only local schemes and the dev server pass. */
export function isAllowedRequest(url: string, devServerOrigin: string | null): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (LOCAL_SCHEMES.has(parsed.protocol)) return true
  if (devServerOrigin === null) return false
  const dev = new URL(devServerOrigin)
  const sameHost = parsed.hostname === dev.hostname && parsed.port === dev.port
  return sameHost && ['http:', 'ws:'].includes(parsed.protocol)
}

export function isAllowedPermission(permission: string): boolean {
  return ALLOWED_PERMISSIONS.has(permission)
}
