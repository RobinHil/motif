// Crash recovery (SPEC 3): the renderer autosaves every 30 seconds to a fixed file. A lock file
// marks a running session; finding it at startup means the previous session did not quit cleanly.
// Node only, no Electron import.
import { readFile, rm, stat, writeFile } from 'node:fs/promises'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { assertProjectText, writeFileAtomic } from './project-files'

export interface RecoveryData {
  text: string
  /** The project folder the recovered project was saved to, if any. */
  projectDir: string | null
  savedAt: string
}

export class Recovery {
  private readonly lockFile: string
  private readonly dataFile: string
  private crashed = false

  constructor(private readonly dir: string) {
    this.lockFile = join(dir, 'session.lock')
    this.dataFile = join(dir, 'recovery.json')
  }

  /** Call once at startup: detects an unclean exit, then marks this session as running. */
  async start(): Promise<void> {
    await mkdir(this.dir, { recursive: true })
    this.crashed = await exists(this.lockFile)
    if (!this.crashed) await rm(this.dataFile, { force: true })
    await writeFile(this.lockFile, String(process.pid), 'utf8')
  }

  async write(text: string, projectDir: string | null, now: Date = new Date()): Promise<void> {
    assertProjectText(text)
    const data: RecoveryData = { text, projectDir, savedAt: now.toISOString() }
    await writeFileAtomic(this.dataFile, JSON.stringify(data))
  }

  /** The autosaved project, only after a crash. */
  async read(): Promise<RecoveryData | null> {
    if (!this.crashed) return null
    try {
      const data = JSON.parse(await readFile(this.dataFile, 'utf8')) as Partial<RecoveryData>
      if (typeof data.text !== 'string' || typeof data.savedAt !== 'string') return null
      return {
        text: data.text,
        projectDir: typeof data.projectDir === 'string' ? data.projectDir : null,
        savedAt: data.savedAt,
      }
    } catch {
      return null
    }
  }

  /** After a successful save, or once the recovered project was restored or discarded. */
  async clear(): Promise<void> {
    this.crashed = false
    await rm(this.dataFile, { force: true })
  }

  /** Clean quit: nothing to recover next time. */
  async stop(): Promise<void> {
    await rm(this.dataFile, { force: true })
    await rm(this.lockFile, { force: true })
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}
