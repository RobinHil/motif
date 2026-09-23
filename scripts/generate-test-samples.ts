// Synthesizes the phase 0 test kit (bd, sd, hh) so no third-party sample is needed.
// Output is deterministic: running it twice produces identical files.
// Usage: bun run samples:test
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SAMPLE_RATE = 48000
const OUT_DIR = join(import.meta.dirname, '..', 'resources', 'samples', 'test')

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

const kit = { bd: kick(), sd: snare(), hh: hihat() }
const manifest: Record<string, string[]> = {}

for (const [name, samples] of Object.entries(kit)) {
  mkdirSync(join(OUT_DIR, name), { recursive: true })
  writeFileSync(join(OUT_DIR, name, '0.wav'), encodeWav16(samples))
  manifest[name] = [`${name}/0.wav`]
}

writeFileSync(join(OUT_DIR, 'strudel.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Wrote ${Object.keys(kit).join(', ')} to ${OUT_DIR}`)
