// Icon containers written by hand: both are lists of PNG images with a small header.

/** Windows `.ico` with PNG entries (supported since Windows Vista). */
export function encodeIco(images: readonly { size: number; png: Uint8Array }[]): Buffer {
  const header = Buffer.alloc(6 + images.length * 16)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach(({ size, png }, i) => {
    const entry = 6 + i * 16
    header.writeUInt8(size >= 256 ? 0 : size, entry)
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1)
    header.writeUInt8(0, entry + 2)
    header.writeUInt8(0, entry + 3)
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(png.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += png.length
  })
  return Buffer.concat([header, ...images.map((i) => Buffer.from(i.png))])
}

/** macOS `.icns` entry types holding PNG data, by pixel size (the @2x types reuse larger images). */
export const ICNS_TYPES: readonly { type: string; size: number }[] = [
  { type: 'icp4', size: 16 },
  { type: 'icp5', size: 32 },
  { type: 'ic11', size: 32 },
  { type: 'icp6', size: 64 },
  { type: 'ic12', size: 64 },
  { type: 'ic07', size: 128 },
  { type: 'ic08', size: 256 },
  { type: 'ic13', size: 256 },
  { type: 'ic09', size: 512 },
  { type: 'ic14', size: 512 },
  { type: 'ic10', size: 1024 },
]

export function encodeIcns(pngBySize: ReadonlyMap<number, Uint8Array>): Buffer {
  const entries = ICNS_TYPES.flatMap(({ type, size }) => {
    const png = pngBySize.get(size)
    if (!png) return []
    const head = Buffer.alloc(8)
    head.write(type, 0, 'ascii')
    head.writeUInt32BE(png.length + 8, 4)
    return [Buffer.concat([head, Buffer.from(png)])]
  })
  const body = Buffer.concat(entries)
  const head = Buffer.alloc(8)
  head.write('icns', 0, 'ascii')
  head.writeUInt32BE(body.length + 8, 4)
  return Buffer.concat([head, body])
}

/** The inner elements of an SVG document, to nest it in another one. */
export function svgInner(svg: string): string {
  const open = svg.indexOf('>', svg.indexOf('<svg'))
  const close = svg.lastIndexOf('</svg>')
  return svg.slice(open + 1, close).trim()
}

/**
 * macOS icon (Apple's template): the full-bleed artwork scaled into an 824 px rounded square
 * centered on a transparent 1024 px canvas.
 */
export function macIconSvg(iconSvg: string): string {
  const scale = 824 / 1024
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs><clipPath id="squircle"><rect x="100" y="100" width="824" height="824" rx="185"/></clipPath></defs>
  <g clip-path="url(#squircle)"><g transform="translate(100 100) scale(${String(scale)})">${svgInner(iconSvg)}</g></g>
</svg>`
}

/** Document icon for `.motif` projects: a page with a folded corner and the symbol. */
export function documentIconSvg(symbolSvg: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <path d="M 212 72 H 652 L 812 232 V 912 Q 812 952 772 952 H 212 Q 172 952 172 912 V 112 Q 172 72 212 72 Z" fill="#141416" stroke="#EDEDEF" stroke-opacity="0.18" stroke-width="12"/>
  <path d="M 652 72 V 192 Q 652 232 692 232 H 812" fill="#1D1D21" stroke="#EDEDEF" stroke-opacity="0.18" stroke-width="12"/>
  <g transform="translate(272 352) scale(15)">${svgInner(symbolSvg)}</g>
</svg>`
}
