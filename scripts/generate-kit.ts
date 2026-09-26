// Synthesizes the bundled sounds: two drum banks (MotifKit, and MotifTape, a lo-fi copy), tuned
// instruments and textures, so no third-party sample is needed (CC0, see LICENSES.md). Output is
// deterministic: running it twice produces identical files.
// Usage: bun run samples:kit
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const SAMPLE_RATE = 48000
const OUT_DIR = join(import.meta.dirname, '..', 'resources', 'samples', 'motif-kit')
const BANK = 'MotifKit'
const TAPE_BANK = 'MotifTape'

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

function kick(base = 45, sweep = 110, decay = 7, seconds = 0.6, click = 0): Float32Array {
  let phase = 0
  const random = mulberry32(11)
  return render(seconds, (t) => {
    const freq = base + sweep * Math.exp(-t * 28)
    phase += (2 * Math.PI * freq) / SAMPLE_RATE
    const attack = click > 0 ? (random() * 2 - 1) * click * Math.exp(-t * 400) : 0
    return Math.sin(phase) * Math.exp(-t * decay) * 0.9 + attack
  })
}

function snare(seed = 1, tone = 185, noiseDecay = 16, seconds = 0.3): Float32Array {
  const random = mulberry32(seed)
  let previous = 0
  return render(seconds, (t) => {
    const white = random() * 2 - 1
    const bright = white - previous
    previous = white
    const body = Math.sin(2 * Math.PI * tone * t) * Math.exp(-t * 30)
    return (bright * 0.55 * Math.exp(-t * noiseDecay) + body * 0.5) * 0.8
  })
}

function hihat(seed = 2, seconds = 0.09, decay = 55, level = 0.45): Float32Array {
  const random = mulberry32(seed)
  let previous = 0
  return render(seconds, (t) => {
    const white = random() * 2 - 1
    const high = white - previous
    previous = white
    return high * level * Math.exp(-t * decay)
  })
}

function clap(seed = 3): Float32Array {
  const random = mulberry32(seed)
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

function tom(freq: number): Float32Array {
  let phase = 0
  return render(0.5, (t) => {
    const f = freq * (1 + 0.6 * Math.exp(-t * 20))
    phase += (2 * Math.PI * f) / SAMPLE_RATE
    return Math.sin(phase) * Math.exp(-t * 8) * 0.85
  })
}

/** Metallic noise: square waves at inharmonic ratios, high-passed (cymbals, cowbell). */
function metal(freqs: number[], seconds: number, decay: number, level: number): Float32Array {
  let previous = 0
  return render(seconds, (t) => {
    const sum = freqs.reduce((acc, f) => acc + (Math.sin(2 * Math.PI * f * t) >= 0 ? 1 : -1), 0) / freqs.length
    const high = sum - previous
    previous = sum
    return high * level * Math.exp(-t * decay)
  })
}

function shaker(): Float32Array {
  const random = mulberry32(5)
  let previous = 0
  return render(0.16, (t) => {
    const white = random() * 2 - 1
    const high = white - previous
    previous = white
    const envelope = Math.min(1, t / 0.03) * Math.exp(-Math.max(0, t - 0.03) * 40)
    return high * 0.35 * envelope
  })
}

const midiToFreq = (midi: number) => 440 * 2 ** ((midi - 69) / 12)
/** Strudel's note numbers: c3 is 48. */
const NOTES: Record<string, number> = { c2: 36, c3: 48, c4: 60, c5: 72 }

function epiano(freq: number): Float32Array {
  return render(1.6, (t) => {
    const index = 2.2 * Math.exp(-t * 3)
    const modulator = Math.sin(2 * Math.PI * freq * t) * index
    const tine = Math.sin(2 * Math.PI * freq * 14 * t) * 0.08 * Math.exp(-t * 20)
    return (Math.sin(2 * Math.PI * freq * t + modulator) + tine) * Math.exp(-t * 1.6) * 0.55
  })
}

/** Karplus-Strong plucked string. */
function pluck(freq: number, seed: number): Float32Array {
  const random = mulberry32(seed)
  const period = Math.max(2, Math.round(SAMPLE_RATE / freq))
  const line = Float32Array.from({ length: period }, () => random() * 2 - 1)
  let index = 0
  return render(1.4, () => {
    const current = line[index] ?? 0
    const next = line[(index + 1) % period] ?? 0
    line[index] = 0.5 * (current + next) * 0.996
    index = (index + 1) % period
    return current * 0.5
  })
}

function bell(freq: number): Float32Array {
  const partials: [number, number, number][] = [
    [1, 1, 1.2],
    [2.76, 0.5, 2],
    [5.4, 0.3, 3.5],
    [8.93, 0.18, 5],
  ]
  return render(
    2,
    (t) =>
      partials.reduce(
        (sum, [ratio, level, decay]) => sum + Math.sin(2 * Math.PI * freq * ratio * t) * level * Math.exp(-t * decay),
        0,
      ) * 0.35,
  )
}

function marimba(freq: number): Float32Array {
  return render(
    1,
    (t) =>
      (Math.sin(2 * Math.PI * freq * t) + Math.sin(2 * Math.PI * freq * 4 * t) * 0.25 * Math.exp(-t * 18)) *
      Math.exp(-t * 5) *
      0.7,
  )
}

function rain(): Float32Array {
  const random = mulberry32(6)
  let low = 0
  const drops: { at: number; freq: number }[] = []
  for (let i = 0; i < 90; i++) drops.push({ at: random() * 3, freq: 2000 + random() * 3000 })
  return render(3, (t) => {
    low += 0.08 * (random() * 2 - 1 - low)
    const patter = drops.reduce(
      (sum, d) =>
        t >= d.at && t < d.at + 0.02
          ? sum + Math.sin(2 * Math.PI * d.freq * (t - d.at)) * Math.exp(-(t - d.at) * 300)
          : sum,
      0,
    )
    const edge = Math.min(1, t / 0.2, (3 - t) / 0.2)
    return (low * 0.5 + patter * 0.25) * edge
  })
}

function vinyl(): Float32Array {
  const random = mulberry32(7)
  let low = 0
  return render(3, (t) => {
    low += 0.02 * (random() * 2 - 1 - low)
    const crackle = random() > 0.9993 ? (random() * 2 - 1) * 0.6 : 0
    const edge = Math.min(1, t / 0.1, (3 - t) / 0.1)
    return (low * 0.6 + crackle) * edge
  })
}

function drone(): Float32Array {
  const seconds = 4
  const freqs = [65.41, 98, 130.81, 196.5]
  return render(seconds, (t) => {
    const sum = freqs.reduce(
      (acc, f, i) => acc + Math.sin(2 * Math.PI * f * t + Math.sin(2 * Math.PI * 0.2 * (i + 1) * t)),
      0,
    )
    const envelope = Math.sin((Math.PI * t) / seconds) ** 0.8
    return (sum / freqs.length) * envelope * 0.5
  })
}

/** A worn tape copy: soft saturation, fewer bits, a gentle low-pass. */
function tape(samples: Float32Array, seed: number): Float32Array {
  const random = mulberry32(seed)
  const out = new Float32Array(samples.length)
  let low = 0
  for (let i = 0; i < samples.length; i++) {
    const driven = Math.tanh((samples[i] ?? 0) * 2.2) * 0.8
    const crushed = Math.round(driven * 24) / 24
    low += 0.35 * (crushed - low)
    out[i] = low + (random() * 2 - 1) * 0.004
  }
  return out
}

/**
 * Tek kick (free party, hard tek): a fast pitch drop into a long distorted sub, with a click.
 * `drive` saturates the body, `tail` sets how long the sub rings, `grit` adds industrial noise.
 */
function tekKick(drive: number, tail: number, grit: number, seed: number): Float32Array {
  const random = mulberry32(seed)
  let phase = 0
  let noise = 0
  return render(tail, (t) => {
    const freq = 46 + 190 * Math.exp(-t * 38)
    phase += (2 * Math.PI * freq) / SAMPLE_RATE
    const body = Math.sin(phase) * Math.exp(-t * (2.2 / tail))
    const click = (random() * 2 - 1) * Math.exp(-t * 900) * 0.6
    noise += 0.3 * (random() * 2 - 1 - noise)
    const rumble = grit > 0 ? noise * grit * Math.exp(-t * 6) : 0
    return Math.tanh((body + click + rumble) * drive) * 0.9
  })
}

/** Industrial metal hit: inharmonic partials with a noisy strike, like a struck pipe or plate. */
function metalHit(freqs: number[], decay: number, seed: number): Float32Array {
  const random = mulberry32(seed)
  return render(0.7, (t) => {
    const ring = freqs.reduce(
      (sum, f, i) => sum + Math.sin(2 * Math.PI * f * t) * Math.exp(-t * decay * (1 + i * 0.4)),
      0,
    )
    const strike = (random() * 2 - 1) * Math.exp(-t * 120)
    return Math.tanh((ring / freqs.length) * 2.5 + strike * 0.5)
  })
}

/** A 4-second noise riser: filtered noise and a saw sweeping up, for build-ups. */
function riser(): Float32Array {
  const random = mulberry32(8)
  const seconds = 4
  let low = 0
  let phase = 0
  return render(seconds, (t) => {
    const progress = t / seconds
    low += (0.02 + 0.5 * progress ** 2) * (random() * 2 - 1 - low)
    phase += (2 * Math.PI * (120 + 1800 * progress ** 2)) / SAMPLE_RATE
    const saw = ((phase / Math.PI) % 2) - 1
    return (low * 0.8 + saw * 0.25) * progress ** 1.5
  })
}

/** Impact: a sub drop under a burst of noise, to land a drop. */
function impact(): Float32Array {
  const random = mulberry32(9)
  let phase = 0
  let low = 0
  return render(2.2, (t) => {
    phase += (2 * Math.PI * (70 * Math.exp(-t * 1.2) + 28)) / SAMPLE_RATE
    low += 0.25 * (random() * 2 - 1 - low)
    return Math.tanh(Math.sin(phase) * Math.exp(-t * 1.6) * 1.6 + low * Math.exp(-t * 3))
  })
}

/** Industrial static: crackling, stuttering noise, for the ending. */
function staticNoise(): Float32Array {
  const random = mulberry32(10)
  let low = 0
  return render(2, (t) => {
    low += 0.4 * (random() * 2 - 1 - low)
    const gate = Math.sin(2 * Math.PI * 12 * t) > 0.2 ? 1 : 0.15
    const crackle = random() > 0.996 ? random() * 2 - 1 : 0
    const edge = Math.min(1, t / 0.05, (2 - t) / 0.05)
    return (low * gate * 0.6 + crackle) * edge
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

type Category = 'Drums' | 'Instruments' | 'Textures'
interface Sound {
  category: Category
  /** Variants (`bd:0`, `bd:1`...), or tuned samples keyed by note for instruments. */
  samples: Float32Array[] | Record<string, Float32Array>
}

/** Scales a new sound so its peak is 0.9. */
function normalize(samples: Float32Array): Float32Array {
  const peak = samples.reduce((max, v) => Math.max(max, Math.abs(v)), 0)
  return peak > 0 ? samples.map((v) => (v / peak) * 0.9) : samples
}

const drums: Record<string, Float32Array[]> = {
  // Variant 0 of bd, hh, cp and rim is the original starter kit, unchanged so projects sound the same.
  bd: [kick(), ...[kick(52, 150, 10, 0.4, 0.25), kick(38, 80, 4, 1), kick(60, 60, 14, 0.3)].map(normalize)],
  // The original snare clipped at full scale: it is normalized like the others (phase 11).
  sd: [snare(), snare(8, 220, 22, 0.22), snare(9, 160, 10, 0.45)].map(normalize),
  hh: [hihat(), ...[hihat(12, 0.05, 90, 0.4), hihat(13, 0.12, 40, 0.5)].map(normalize)],
  oh: [hihat(14, 0.5, 8, 0.4), hihat(15, 0.35, 12, 0.42)].map(normalize),
  cp: [clap(), normalize(clap(16))],
  rim: [rim()],
  lt: [normalize(tom(90))],
  mt: [normalize(tom(130))],
  ht: [normalize(tom(180))],
  cr: [normalize(metal([287, 422, 587, 795, 1101, 1534], 1.6, 2.2, 0.5))],
  rd: [normalize(metal([530, 751, 1060, 1411], 1.2, 3, 0.3))],
  cb: [normalize(metal([562, 845], 0.35, 14, 0.45))],
  sh: [normalize(shaker())],
  tek: [tekKick(2.5, 0.6, 0, 11), tekKick(4, 0.8, 0.15, 12), tekKick(6, 0.9, 0.6, 13)].map(normalize),
  metal: [
    metalHit([523, 1289, 2311, 3700], 9, 14),
    metalHit([311, 877, 1543, 2890], 6, 15),
    metalHit([741, 1666, 2789, 4410], 14, 16),
  ].map(normalize),
}

const sounds: Record<string, Sound> = {
  ...Object.fromEntries(
    Object.entries(drums).map(([name, samples]) => [name, { category: 'Drums' as const, samples }]),
  ),
  epiano: {
    category: 'Instruments',
    samples: Object.fromEntries(Object.entries(NOTES).map(([n, m]) => [n, normalize(epiano(midiToFreq(m)))])),
  },
  pluck: {
    category: 'Instruments',
    samples: Object.fromEntries(Object.entries(NOTES).map(([n, m], i) => [n, normalize(pluck(midiToFreq(m), 20 + i))])),
  },
  bell: {
    category: 'Instruments',
    samples: Object.fromEntries(Object.entries(NOTES).map(([n, m]) => [n, normalize(bell(midiToFreq(m)))])),
  },
  marimba: {
    category: 'Instruments',
    samples: Object.fromEntries(Object.entries(NOTES).map(([n, m]) => [n, normalize(marimba(midiToFreq(m)))])),
  },
  wind: { category: 'Textures', samples: [wind()] },
  rain: { category: 'Textures', samples: [normalize(rain())] },
  vinyl: { category: 'Textures', samples: [normalize(vinyl())] },
  drone: { category: 'Textures', samples: [normalize(drone())] },
  riser: { category: 'Textures', samples: [normalize(riser())] },
  impact: { category: 'Textures', samples: [normalize(impact())] },
  static: { category: 'Textures', samples: [normalize(staticNoise())] },
}

rmSync(OUT_DIR, { recursive: true, force: true })
const manifest: Record<string, string[] | Record<string, string[]>> = {}
const write = (file: string, samples: Float32Array) => {
  mkdirSync(join(OUT_DIR, dirname(file)), { recursive: true })
  writeFileSync(join(OUT_DIR, file), encodeWav16(samples))
  return file
}

for (const [name, sound] of Object.entries(sounds)) {
  if (Array.isArray(sound.samples)) {
    const files = sound.samples.map((samples, i) => write(`${name}/${String(i)}.wav`, samples))
    manifest[name] = files
    if (sound.category === 'Drums') {
      // Strudel's .bank("MotifKit") looks sounds up as MotifKit_bd, MotifKit_sd...
      manifest[`${BANK}_${name}`] = files
      manifest[`${TAPE_BANK}_${name}`] = sound.samples.map((samples, i) =>
        write(`tape/${name}/${String(i)}.wav`, tape(samples, 100 + i)),
      )
    }
  } else {
    manifest[name] = Object.fromEntries(
      Object.entries(sound.samples).map(([note, samples]) => [note, [write(`${name}/${note}.wav`, samples)]]),
    )
  }
}

writeFileSync(join(OUT_DIR, 'strudel.json'), `${JSON.stringify(manifest, null, 2)}\n`)
writeFileSync(
  join(OUT_DIR, 'catalog.json'),
  `${JSON.stringify({ banks: [BANK, TAPE_BANK], sounds: Object.entries(sounds).map(([name, s]) => ({ name, category: s.category })) }, null, 2)}\n`,
)
console.log(`Wrote ${Object.keys(sounds).join(', ')} to ${OUT_DIR}`)
