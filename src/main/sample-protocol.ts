import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, net, protocol } from 'electron'
import { resolveSampleFile, SAMPLE_SCHEME, type SampleRoots } from './sample-path'

/** Must run before the app is ready. */
export function registerSampleScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SAMPLE_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true },
    },
  ])
}

export function bundledSamplesRoot(): string {
  return app.isPackaged ? join(process.resourcesPath, 'samples') : join(app.getAppPath(), 'resources', 'samples')
}

export function handleSampleProtocol(roots: SampleRoots): void {
  protocol.handle(SAMPLE_SCHEME, async (request) => {
    const file = await resolveSampleFile(request.url, roots)
    if (file === null) return new Response('Not found', { status: 404 })
    const response = await net.fetch(pathToFileURL(file).toString())
    const headers = new Headers(response.headers)
    headers.set('Access-Control-Allow-Origin', '*')
    return new Response(response.body, { status: response.status, headers })
  })
}
