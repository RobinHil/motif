// Canvas drawings shared by several screens (DESIGN.md "Visualizations": monochrome white at
// 30 to 70% opacity, accent only on peaks and low frequencies).

/** Spectrum bars from analyser data in dB, on logarithmic bins. */
export function drawSpectrum(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: Float32Array,
  accent: string,
  bars = 64,
): void {
  const barWidth = width / bars
  for (let i = 0; i < bars; i++) {
    const bin = Math.min(data.length - 1, Math.floor(((data.length - 1) * (Math.pow(2, (i / bars) * 10) - 1)) / 1023))
    const level = Math.max(0, Math.min(1, ((data[bin] ?? -120) + 100) / 70))
    context.fillStyle = i < bars / 8 || level > 0.85 ? accent : `rgba(237, 237, 239, ${String(0.3 + 0.4 * level)})`
    context.fillRect(i * barWidth + 1, height - level * height, Math.max(1, barWidth - 2), level * height)
  }
}

/** Oscilloscope line from time-domain samples (-1..1). */
export function drawWaveform(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: Float32Array,
): void {
  context.strokeStyle = 'rgba(237, 237, 239, 0.7)'
  context.lineWidth = 1.5
  context.beginPath()
  for (let i = 0; i < data.length; i++) {
    const x = (i / (data.length - 1)) * width
    const y = height / 2 - (data[i] ?? 0) * (height / 2) * 0.9
    if (i === 0) context.moveTo(x, y)
    else context.lineTo(x, y)
  }
  context.stroke()
}
