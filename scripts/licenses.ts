// Shared by scripts/third-party-licenses.ts: dependency walking and license policy.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export interface PackageInfo {
  name: string
  version: string
  license: string
  repository: string | null
  licenseText: string | null
}

interface Manifest {
  name: string
  version: string
  license?: string | { type?: string }
  licenses?: { type?: string }[]
  repository?: string | { url?: string }
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

/**
 * Licenses whose code may be bundled into an AGPL-3.0-or-later program.
 * OFL-1.1 covers the Geist fonts, which are shipped as separate files.
 */
export const COMPATIBLE_LICENSES = new Set([
  '0BSD',
  'AGPL-3.0-only',
  'AGPL-3.0-or-later',
  'Apache-2.0',
  'BlueOak-1.0.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'CC0-1.0',
  'GPL-3.0-only',
  'GPL-3.0-or-later',
  'ISC',
  'LGPL-2.1-or-later',
  'LGPL-3.0-only',
  'LGPL-3.0-or-later',
  'MIT',
  'MIT-0',
  'MPL-2.0',
  'OFL-1.1',
  'Python-2.0',
  'Unlicense',
  'Zlib',
])

/** Evaluates an SPDX expression (AND, OR, parentheses) against the allowed list. */
export function isCompatible(expression: string, allowed: ReadonlySet<string> = COMPATIBLE_LICENSES): boolean {
  const tokens = expression.replace(/[()]/g, ' $& ').trim().split(/\s+/).filter(Boolean)
  let position = 0

  const parseOr = (): boolean => {
    let result = parseAnd()
    while (tokens[position]?.toUpperCase() === 'OR') {
      position++
      const right = parseAnd()
      result = result || right
    }
    return result
  }
  const parseAnd = (): boolean => {
    let result = parseAtom()
    while (tokens[position]?.toUpperCase() === 'AND') {
      position++
      const right = parseAtom()
      result = result && right
    }
    return result
  }
  const parseAtom = (): boolean => {
    const token = tokens[position++]
    if (token === '(') {
      const result = parseOr()
      position++
      return result
    }
    if (token === undefined) return false
    if (!token.endsWith('+')) return allowed.has(token)
    // Deprecated "X+" form, e.g. LGPL-3.0+ means LGPL-3.0-or-later.
    const base = token.slice(0, -1)
    return allowed.has(base) || allowed.has(`${base}-or-later`)
  }

  if (tokens.length === 0) return false
  const result = parseOr()
  return result && position === tokens.length
}

function readManifest(dir: string): Manifest {
  return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Manifest
}

function licenseOf(manifest: Manifest): string {
  if (typeof manifest.license === 'string') return manifest.license
  if (manifest.license?.type) return manifest.license.type
  const legacy = manifest.licenses?.map((l) => l.type).filter(Boolean)
  return legacy?.length ? `(${legacy.join(' OR ')})` : 'UNKNOWN'
}

function repositoryOf(manifest: Manifest): string | null {
  const repo = typeof manifest.repository === 'string' ? manifest.repository : manifest.repository?.url
  return repo?.replace(/^git\+/, '').replace(/\.git$/, '') ?? null
}

function licenseTextOf(dir: string): string | null {
  const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.|-|$)/i.test(f))
  return file ? readFileSync(join(dir, file), 'utf8').trim() : null
}

/** Node-style resolution: look in each ancestor's node_modules, stopping at the project root. */
function resolvePackageDir(name: string, fromDir: string, root: string): string | null {
  let dir = fromDir
  for (;;) {
    const candidate = join(dir, 'node_modules', name)
    if (existsSync(join(candidate, 'package.json'))) return candidate
    if (dir === root) return null
    const parent = dirname(dir)
    dir = parent === dir ? root : parent
  }
}

/** Every installed package reachable from the project's production dependencies. */
export function collectProductionPackages(root: string): PackageInfo[] {
  const project = readManifest(root)
  const seen = new Map<string, PackageInfo>()
  const queue: { name: string; from: string }[] = Object.keys(project.dependencies ?? {}).map((name) => ({
    name,
    from: root,
  }))

  while (queue.length > 0) {
    const next = queue.shift()
    if (!next) break
    const dir = resolvePackageDir(next.name, next.from, root)
    if (dir === null) continue
    const manifest = readManifest(dir)
    const key = `${manifest.name}@${manifest.version}`
    if (seen.has(key)) continue
    seen.set(key, {
      name: manifest.name,
      version: manifest.version,
      license: licenseOf(manifest),
      repository: repositoryOf(manifest),
      licenseText: licenseTextOf(dir),
    })
    const children = {
      ...manifest.dependencies,
      ...manifest.optionalDependencies,
      ...manifest.peerDependencies,
    }
    for (const name of Object.keys(children)) queue.push({ name, from: dir })
  }

  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))
}
