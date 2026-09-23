// Recently opened or saved project folders, for the home screen. The renderer only sees names and
// opaque ids: paths stay in the main process. Node only, no Electron import.
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { projectNameFromDir, writeFileAtomic } from './project-files'

const MAX_RECENT = 10

export interface RecentEntry {
  id: string
  name: string
}

export class RecentProjects {
  private dirs: string[] | null = null

  constructor(private readonly file: string) {}

  private async load(): Promise<string[]> {
    if (this.dirs) return this.dirs
    try {
      const parsed: unknown = JSON.parse(await readFile(this.file, 'utf8'))
      this.dirs = Array.isArray(parsed) ? parsed.filter((e): e is string => typeof e === 'string') : []
    } catch {
      this.dirs = []
    }
    return this.dirs
  }

  static idOf(dir: string): string {
    return createHash('sha256').update(dir).digest('hex').slice(0, 16)
  }

  /** Moves `dir` to the top of the list. */
  async add(dir: string): Promise<void> {
    const dirs = [dir, ...(await this.load()).filter((d) => d !== dir)].slice(0, MAX_RECENT)
    this.dirs = dirs
    await writeFileAtomic(this.file, JSON.stringify(dirs))
  }

  async list(): Promise<RecentEntry[]> {
    return (await this.load()).map((dir) => ({ id: RecentProjects.idOf(dir), name: projectNameFromDir(dir) }))
  }

  async resolve(id: unknown): Promise<string | null> {
    if (typeof id !== 'string') return null
    return (await this.load()).find((dir) => RecentProjects.idOf(dir) === id) ?? null
  }

  async remove(dir: string): Promise<void> {
    this.dirs = (await this.load()).filter((d) => d !== dir)
    await writeFileAtomic(this.file, JSON.stringify(this.dirs))
  }
}
