/** Minimum and maximum of each of `buckets` equal parts of a channel, for drawing a waveform. */
export function waveformPeaks(channel: Float32Array, buckets: number): [number, number][] {
  const peaks: [number, number][] = []
  const size = channel.length / buckets
  for (let b = 0; b < buckets; b++) {
    let min = 0
    let max = 0
    const end = Math.min(channel.length, Math.floor((b + 1) * size))
    for (let i = Math.floor(b * size); i < end; i++) {
      const v = channel[i] ?? 0
      if (v < min) min = v
      if (v > max) max = v
    }
    peaks.push([min, max])
  }
  return peaks
}
