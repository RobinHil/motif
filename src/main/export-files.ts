// Writing exported audio and code (SPEC 9). Node only, no Electron import.
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { ExportFile } from '@shared/ipc'

/** Far above a long song in 24-bit stereo; protects the main process from absurd payloads. */
export const MAX_EXPORT_BYTES = 2 * 1024 * 1024 * 1024

/** A file name the renderer may ask for: no path, no control or reserved characters. */
export function safeFileName(name: string): string {
  const clean = Array.from(basename(name))
    .filter((c) => c.charCodeAt(0) >= 32 && !'\\\\/:*?"<>|'.includes(c))
    .join('')
    .trim()
    .replace(/^\.+/, '')
  return clean.slice(0, 150) || 'Motif export'
}

export function validExportFiles(files: unknown): ExportFile[] | null {
  if (!Array.isArray(files) || files.length === 0 || files.length > 256) return null
  let total = 0
  const valid: ExportFile[] = []
  for (const file of files as unknown[]) {
    const { name, data } = (file ?? {}) as { name?: unknown; data?: unknown }
    if (typeof name !== 'string' || !(data instanceof ArrayBuffer)) return null
    total += data.byteLength
    valid.push({ name: safeFileName(name), data })
  }
  return total <= MAX_EXPORT_BYTES ? valid : null
}

/** Writes each file into `folder` (created if needed), keeping names unique. */
export async function writeExportFiles(folder: string, files: readonly ExportFile[]): Promise<string[]> {
  await mkdir(folder, { recursive: true })
  const used = new Set<string>()
  const written: string[] = []
  for (const file of files) {
    let name = file.name
    for (let i = 2; used.has(name.toLowerCase()); i++) name = file.name.replace(/(\.[^.]+)?$/, ` ${String(i)}$1`)
    used.add(name.toLowerCase())
    await writeFile(join(folder, name), new Uint8Array(file.data))
    written.push(name)
  }
  return written
}
