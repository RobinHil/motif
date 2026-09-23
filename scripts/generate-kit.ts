// Synthesizes MotifKit, the bundled starter kit (drums and a wind texture), so no third-party
// sample is needed. Output is deterministic: running it twice produces identical files.
// Usage: bun run samples:kit
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SAMPLE_RATE = 48000
const OUT_DIR = join(import.meta.dirname, '..', 'resources', 'samples', 'motif-kit')
const BANK = 'MotifKit'

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function render(seconds: number, sample: (t: number, i: number) => number): Float32Array {
  const out = new Float32Array(Math.round(seconds * SAMPLE_RATE))
  for (let i = 0; i < out.length; i++) out[i] = sample(i / SAMPLE_RATE, i)
  // 2 ms fade out to avoid a click at the end.
  const fade = Math.round(0.002 * SAMPLE_RATE)
  for (let i = 0; i < fade; i++) out[out.length - 1 - i] = (out[out.length - 1 - i] ?? 0) * (i / fade)
  return out
}

function kick(): Float32Array {
  let phase = 0
  return render(0.6, (t) => {
    const freq = 45 + 110 * Math.exp(-t * 28)
    phase += (2 * Math.PI * freq) / SAMPLE_RATE
    return Math.sin(phase) * Math.exp(-t * 7) * 0.9
  })
}

function snare(): Float32Array {
  const random = mulberry32(1)
  let previous = 0
  return render(0.3, (t) => {
    const white = random() * 2 - 1
    const bright = white - previous
    previous = white
    const tone = Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t * 30)
    return (bright * 0.55 * Math.exp(-t * 16) + tone * 0.5) * 0.8
  })
}

function hihat(): Float32Array {
  const random = mulberry32(2)
  let previous = 0
  return render(0.09, (t) => {
    const white = random() * 2 - 1
    const high = white - previous
    previous = white
    return high * 0.45 * Math.exp(-t * 55)
  })
}

function clap(): Float32Array {
  const random = mulberry32(3)
  let low = 0
  return render(0.35, (t) => {
    const white = random() * 2 - 1
    low += 0.35 * (white - low)
    const band = white - low
    // Three quick bursts, then a short diffuse tail.
    const burst = [0, 0.011, 0.023].reduce((sum, at) => sum + (t >= at ? Math.exp(-(t - at) * 180) : 0), 0)
    const tail = t >= 0.023 ? Math.exp(-(t - 0.023) * 22) * 0.5 : 0
    return band * (burst + tail) * 0.7
  })
}

function rim(): Float32Array {
  return render(0.12, (t) => {
    const body = Math.sin(2 * Math.PI * 1680 * t) * 0.6 + Math.sin(2 * Math.PI * 520 * t) * 0.4
    return body * Math.exp(-t * 60) * 0.8
  })
}

function wind(): Float32Array {
  const random = mulberry32(4)
  let low = 0
  let lower = 0
  const seconds = 2
  return render(seconds, (t) => {
    const white = random() * 2 - 1
    // Cutoff sways slowly so the noise breathes like wind.
    const sway = 0.02 + 0.03 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.7 * t))
    low += sway * (white - low)
    lower += 0.2 * (low - lower)
    const envelope = Math.sin((Math.PI * t) / seconds) ** 1.5
    return lower * envelope * 2.2
  })
}

function encodeWav16(samples: Float32Array): Buffer {
  const dataSize = samples.length * 2
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0, 'ascii')
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8, 'ascii')
  buffer.write('fmt ', 12, 'ascii')
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(SAMPLE_RATE, 24)
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36, 'ascii')
  buffer.writeUInt32LE(dataSize, 40)
  samples.forEach((value, i) => {
    const clamped = Math.max(-1, Math.min(1, value))
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2)
  })
  return buffer
}

const kit = { bd: kick(), sd: snare(), hh: hihat(), cp: clap(), rim: rim(), wind: wind() }
const categories: Record<keyof typeof kit, string> = {
  bd: 'Drums',
  sd: 'Drums',
  hh: 'Drums',
  cp: 'Drums',
  rim: 'Drums',
  wind: 'Textures',
}
const manifest: Record<string, string[]> = {}

for (const [name, samples] of Object.entries(kit)) {
  mkdirSync(join(OUT_DIR, name), { recursive: true })
  writeFileSync(join(OUT_DIR, name, '0.wav'), encodeWav16(samples))
  const files = [`${name}/0.wav`]
  manifest[name] = files
  // Strudel's .bank("MotifKit") looks sounds up as MotifKit_bd, MotifKit_sd...
  if (categories[name as keyof typeof kit] === 'Drums') manifest[`${BANK}_${name}`] = files
}

writeFileSync(join(OUT_DIR, 'strudel.json'), `${JSON.stringify(manifest, null, 2)}\n`)
writeFileSync(
  join(OUT_DIR, 'catalog.json'),
  `${JSON.stringify({ banks: [BANK], sounds: Object.entries(categories).map(([name, category]) => ({ name, category })) }, null, 2)}\n`,
)
console.log(`Wrote ${Object.keys(kit).join(', ')} to ${OUT_DIR}`)
