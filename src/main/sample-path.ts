import { realpath } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve } from 'node:path'
import { AUDIO_EXTENSIONS } from '@shared/samples'

export const SAMPLE_SCHEME = 'motif-sample'

const ALLOWED_EXTENSIONS = new Set<string>([...AUDIO_EXTENSIONS, '.json'])

/** Named folders a sample URL may point into, e.g. { bundled: '/opt/Motif/resources/samples' }. */
export type SampleRoots = Readonly<Record<string, string>>

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

/**
 * Maps `motif-sample://<root>/<path>` to a file inside that root, or null.
 * Lexical check only; `resolveSampleFile` also resolves symbolic links.
 */
export function resolveSamplePath(url: string, roots: SampleRoots): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== `${SAMPLE_SCHEME}:`) return null
  if (!Object.hasOwn(roots, parsed.hostname)) return null
  const root = roots[parsed.hostname]
  if (root === undefined) return null

  let relativePath: string
  try {
    relativePath = decodeURIComponent(parsed.pathname)
  } catch {
    return null
  }
  if (relativePath.includes('\0') || relativePath.includes('\\')) return null

  const rootPath = resolve(root)
  const candidate = resolve(rootPath, `.${relativePath}`)
  if (!isInside(rootPath, candidate)) return null
  if (!ALLOWED_EXTENSIONS.has(extname(candidate).toLowerCase())) return null
  return candidate
}

/** Same as `resolveSamplePath`, then rejects files whose real location leaves the root (symbolic links). */
export async function resolveSampleFile(url: string, roots: SampleRoots): Promise<string | null> {
  const lexical = resolveSamplePath(url, roots)
  if (lexical === null) return null
  const root = roots[new URL(url).hostname]
  if (root === undefined) return null
  try {
    const [realRoot, realFile] = await Promise.all([realpath(root), realpath(lexical)])
    return isInside(realRoot, realFile) ? realFile : null
  } catch {
    return null
  }
}
