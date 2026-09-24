// Which imported samples a project uses, so saving copies them into the project folder (SPEC 7).
import type { Project, SampleEntry } from './project'

/** An imported sound, as the library lists it: files relative to its folder (`breaks/0.wav`). */
export interface UserSound {
  name: string
  files: string[]
  folder: string
}

/** Every sound name a project may play: sources, step rows, and words of free code. */
export function usedSoundNames(project: Project): Set<string> {
  const names = new Set<string>()
  for (const track of project.tracks) {
    if (track.source.type === 'sample' || track.source.type === 'synth') names.add(track.source.name)
    for (const row of track.steps?.rows ?? []) names.add(row.sound)
    const texts = [track.code ?? '', ...track.transforms.map((t) => Object.values(t.args).join(' '))]
    for (const text of texts) for (const word of text.match(/[A-Za-z0-9_]+/g) ?? []) names.add(word)
  }
  return names
}

/** `sampleLibrary` for saving: the imported sounds the project uses, in library order. */
export function projectSampleLibrary(project: Project, userSounds: readonly UserSound[]): SampleEntry[] {
  const used = usedSoundNames(project)
  return userSounds
    .filter((sound) => used.has(sound.name))
    .map((sound) => ({ name: sound.name, files: [...sound.files], origin: 'user' as const, folder: sound.folder }))
}
