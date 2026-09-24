// Sample naming and formats, shared by the main process (import) and the renderer (messages).

/** Formats Chromium decodes. Anything else is rejected at import (SPEC 7). */
export const AUDIO_EXTENSIONS = ['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.aac', '.opus', '.webm'] as const

export const MAX_SOUND_NAME = 32

/** Strudel's built-in synths and noises: an imported sound must not hide them. */
export const BUILT_IN_SOUNDS = [
  'triangle',
  'square',
  'sawtooth',
  'sine',
  'tri',
  'sqr',
  'saw',
  'sin',
  'user',
  'one',
  'supersaw',
  'pulse',
  'white',
  'pink',
  'brown',
  'crackle',
  'sbd',
  'bytebeat',
] as const

export function isAudioFile(fileName: string): boolean {
  const dot = fileName.lastIndexOf('.')
  return dot > 0 && (AUDIO_EXTENSIONS as readonly string[]).includes(fileName.slice(dot).toLowerCase())
}

/**
 * A sound name Strudel reads as one word: lowercase letters, digits and underscores, starting with a
 * letter (`808 Kick.wav` -> `s_808_kick`).
 */
export function soundNameFrom(text: string): string {
  const plain = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const name = /^[a-z]/.test(plain) ? plain : plain ? `s_${plain}` : 'sample'
  return name.slice(0, MAX_SOUND_NAME).replace(/_+$/, '')
}

/** `name`, or `name_2`, `name_3`... when taken. */
export function uniqueName(name: string, taken: ReadonlySet<string>): string {
  if (!taken.has(name)) return name
  for (let i = 2; ; i++) {
    const candidate = `${name.slice(0, MAX_SOUND_NAME - String(i).length - 1)}_${String(i)}`
    if (!taken.has(candidate)) return candidate
  }
}
