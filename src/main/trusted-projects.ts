// Project folders this installation saved itself. Opening any other project that contains free code
// shows a warning, because Strudel code is JavaScript. Node only, no Electron import.
import { readFile, realpath } from 'node:fs/promises'
import { writeFileAtomic } from './project-files'

const MAX_ENTRIES = 500

export class TrustedProjects {
  private entries: string[] | null = null

  constructor(private readonly file: string) {}

  private async load(): Promise<string[]> {
    if (this.entries) return this.entries
    try {
      const parsed: unknown = JSON.parse(await readFile(this.file, 'utf8'))
      this.entries = Array.isArray(parsed) ? parsed.filter((e): e is string => typeof e === 'string') : []
    } catch {
      this.entries = []
    }
    return this.entries
  }

  async trust(dir: string): Promise<void> {
    const key = await canonical(dir)
    const entries = (await this.load()).filter((e) => e !== key)
    entries.push(key)
    this.entries = entries.slice(-MAX_ENTRIES)
    await writeFileAtomic(this.file, JSON.stringify(this.entries))
  }

  async isTrusted(dir: string): Promise<boolean> {
    return (await this.load()).includes(await canonical(dir))
  }
}

async function canonical(dir: string): Promise<string> {
  try {
    return await realpath(dir)
  } catch {
    return dir
  }
}
