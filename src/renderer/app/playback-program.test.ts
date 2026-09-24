import { describe, expect, it } from 'vitest'
import { createDemoProject } from '../model/demo'
import { playbackProgram } from './playback-program'

describe('playback program', () => {
  const project = createDemoProject(new Date(0))

  it('plays the song in song mode, and every track in live mode without a scene', () => {
    expect(playbackProgram(project, { arrangeMode: 'song', liveScene: null, queued: null }).kind).toBe('song')
    const live = playbackProgram(project, { arrangeMode: 'live', liveScene: null, queued: null })
    expect(live.code).not.toContain('_$:')
    expect(
      playbackProgram({ ...project, arrangement: [] }, { arrangeMode: 'song', liveScene: null, queued: null }).kind,
    ).toBeUndefined()
  })

  it('writes a queued scene change, and ignores deleted scenes', () => {
    const queued = playbackProgram(project, {
      arrangeMode: 'live',
      liveScene: 'demo-scene-intro',
      queued: { sceneId: 'demo-scene-outro', atCycle: 9 },
    })
    expect(queued.code).toContain('.filterWhen(t => t < 9)')
    const gone = playbackProgram(project, { arrangeMode: 'live', liveScene: 'deleted', queued: null })
    expect(gone.code).not.toContain('_$:')
  })
})
