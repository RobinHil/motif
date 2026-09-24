import { generateProjectCode, type GeneratedCode } from '../codegen/generate'
import { generateSongCode } from '../codegen/song'
import type { Project } from '../model/project'
import type { TransportState } from '../store/transport-store'

/**
 * What the engine plays: the song in song mode, otherwise the tracks of the live scene, with a
 * queued scene change written into the pattern. The editors always show the plain loop code.
 */
export function playbackProgram(
  project: Project,
  transport: Pick<TransportState, 'arrangeMode' | 'liveScene' | 'queued'>,
): GeneratedCode {
  if (transport.arrangeMode === 'song' && project.arrangement.length > 0) return generateSongCode(project)
  const known = (id: string | null) => (id !== null && project.scenes.some((s) => s.id === id) ? id : null)
  const current = known(transport.liveScene)
  const queued = transport.queued && known(transport.queued.sceneId)
  if (transport.queued && queued !== null)
    return generateProjectCode(project, {
      sceneId: queued,
      switchAt: { cycle: transport.queued.atCycle, fromSceneId: current },
    })
  return generateProjectCode(project, { sceneId: current })
}
