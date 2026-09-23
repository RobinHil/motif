/** Encodes planar float channels as a PCM WAV file (16 or 24 bit). */
export function encodeWav(channels: readonly Float32Array[], sampleRate: number, bitDepth: 16 | 24 = 24): ArrayBuffer {
  const channelCount = channels.length
  const frames = channels[0]?.length ?? 0
  if (channels.some((c) => c.length !== frames)) throw new Error('All channels must have the same length')

  const bytesPerSample = bitDepth / 8
  const blockAlign = channelCount * bytesPerSample
  const dataSize = frames * blockAlign
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  writeAscii(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(8, 'WAVE')
  writeAscii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channelCount, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  writeAscii(36, 'data')
  view.setUint32(40, dataSize, true)

  const max = 2 ** (bitDepth - 1) - 1
  let offset = 44
  for (let frame = 0; frame < frames; frame++) {
    for (const channel of channels) {
      const value = Math.round(Math.max(-1, Math.min(1, channel[frame] ?? 0)) * max)
      if (bitDepth === 16) {
        view.setInt16(offset, value, true)
      } else {
        view.setUint8(offset, value & 0xff)
        view.setUint8(offset + 1, (value >> 8) & 0xff)
        view.setUint8(offset + 2, (value >> 16) & 0xff)
      }
      offset += bytesPerSample
    }
  }
  return buffer
}
