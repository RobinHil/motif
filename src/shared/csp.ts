// 'unsafe-eval' is required: Strudel evaluates transpiled code with Function().
// See docs/DECISIONS.md, "Content Security Policy".
const base: Record<string, string[]> = {
  'default-src': ["'none'"],
  'script-src': ["'self'", "'unsafe-eval'"],
  'style-src': ["'self'"],
  'font-src': ["'self'"],
  'img-src': ["'self'", 'data:', 'blob:'],
  'media-src': ["'self'", 'blob:', 'motif-sample:'],
  'connect-src': ["'self'", 'motif-sample:'],
  'worker-src': ["'self'", 'blob:'],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
  'frame-src': ["'none'"],
  'object-src': ["'none'"],
}

function serialize(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ')
}

export const PRODUCTION_CSP = serialize(base)

// Vite's dev server needs inline scripts (React refresh preamble), inline styles and its HMR socket.
export function developmentCsp(devServerOrigin: string): string {
  const ws = devServerOrigin.replace(/^http/, 'ws')
  return serialize({
    ...base,
    'script-src': [...(base['script-src'] ?? []), "'unsafe-inline'", devServerOrigin],
    'style-src': ["'self'", "'unsafe-inline'", devServerOrigin],
    'connect-src': [...(base['connect-src'] ?? []), devServerOrigin, ws],
  })
}
