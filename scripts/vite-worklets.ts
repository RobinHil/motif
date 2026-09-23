import type { Plugin } from 'vite'

// superdough and supradough ship their AudioWorklet modules inlined as data: URLs, which the CSP
// forbids (no data: in script-src). This plugin swaps each one for a real file served from 'self'.
// See docs/DECISIONS.md, "AudioWorklet modules".
const TARGETS = [
  { match: /\/node_modules\/superdough\/dist\/index\.mjs$/, file: 'superdough-worklets.js' },
  { match: /\/node_modules\/supradough\/dist\/index\.mjs$/, file: 'supradough-worklet.js' },
]
const DATA_URL = /"data:text\/javascript;base64,([A-Za-z0-9+/=]+)"/

export function workletFiles(): Plugin {
  const sources = new Map<string, string>()
  let isBuild = false

  return {
    name: 'motif-worklet-files',
    config: () => ({
      // Pre-bundled dependencies skip transform hooks, so these must stay unbundled in dev.
      optimizeDeps: { exclude: ['@strudel/webaudio', 'superdough', 'supradough'] },
    }),
    configResolved(config) {
      isBuild = config.command === 'build'
    },
    transform(code, id) {
      const target = TARGETS.find(({ match }) => match.test(id.split('?')[0] ?? id))
      if (!target) return null
      const found = DATA_URL.exec(code)
      if (!found?.[1]) {
        this.error(`${target.file}: inline worklet not found in ${id}. Check the package version.`)
      }
      const source = Buffer.from(found[1], 'base64').toString('utf8')
      sources.set(target.file, source)
      const url = isBuild
        ? `import.meta.ROLLUP_FILE_URL_${this.emitFile({ type: 'asset', name: target.file, source })}`
        : JSON.stringify(`/@worklets/${target.file}`)
      return { code: code.replace(found[0], url), map: null }
    },
    configureServer(server) {
      server.middlewares.use('/@worklets/', (req, res, next) => {
        const source = sources.get((req.url ?? '').replace(/^\//, ''))
        if (source === undefined) {
          next()
          return
        }
        res.setHeader('Content-Type', 'text/javascript')
        res.end(source)
      })
    },
  }
}
