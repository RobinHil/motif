import type { z } from 'zod'
import { PROJECT_VERSION, ProjectSchema, type Project } from './project'

export class ProjectLoadError extends Error {
  override name = 'ProjectLoadError'
}

type RawProject = Record<string, unknown>

/** Upgrades a project from version n (the key) to version n + 1. */
export type Migration = (project: RawProject) => RawProject

/** No migration yet: version 1 is the first format. Add `1: (p) => ...` when version 2 ships. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {}

export interface MigrationOptions<T> {
  migrations?: Readonly<Record<number, Migration>>
  currentVersion?: number
  schema?: z.ZodType<T>
}

function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join('.') || 'project'}: ${issue.message}`)
    .join('; ')
}

/**
 * Turns parsed JSON of any known version into a valid current project, or throws a
 * ProjectLoadError whose message can be shown to the user.
 */
export function migrateProject(raw: unknown): Project
export function migrateProject<T>(raw: unknown, options: MigrationOptions<T>): T
export function migrateProject<T>(raw: unknown, options: MigrationOptions<T> = {}): T | Project {
  const migrations = options.migrations ?? MIGRATIONS
  const currentVersion = options.currentVersion ?? PROJECT_VERSION
  const schema = options.schema ?? ProjectSchema

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ProjectLoadError('This file is not a Motif project.')
  }
  let project = raw as RawProject
  let version = project['version']
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new ProjectLoadError('This file is not a Motif project: its version is missing.')
  }
  if (version > currentVersion) {
    throw new ProjectLoadError(`This project was saved by a newer version of Motif (format ${String(version)}).`)
  }
  while (version < currentVersion) {
    const migrate = migrations[version]
    if (!migrate) throw new ProjectLoadError(`No migration from project format ${String(version)}.`)
    project = { ...migrate(project), version: version + 1 }
    version += 1
  }

  const result = schema.safeParse(project)
  if (!result.success) throw new ProjectLoadError(`This project is damaged: ${describeIssues(result.error)}.`)
  return result.data
}

/** Stable, human-readable JSON. Keys follow the schema order because loading re-creates the objects. */
export function serializeProject(project: Project): string {
  return `${JSON.stringify(project, null, 2)}\n`
}
