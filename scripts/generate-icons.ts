// Generates the app and document icon sets from the approved masters in resources/brand
// (DESIGN.md, "Logo and brand identity"). Deterministic. Usage: bun run icons
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import { documentIconSvg, encodeIcns, encodeIco, macIconSvg } from './icon-formats'

const BRAND = join(import.meta.dirname, '..', 'resources', 'brand')
const LINUX_SIZES = [16, 24, 32, 48, 64, 128, 256, 512]
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
const ICNS_SIZES = [16, 32, 64, 128, 256, 512, 1024]

function render(svg: string, size: number): Uint8Array {
  return new Resvg(svg, { fitTo: { mode: 'width', value: size }, font: { loadSystemFonts: false } }).render().asPng()
}

const icon = readFileSync(join(BRAND, 'icon.svg'), 'utf8')
const mac = macIconSvg(icon)
const documentIcon = documentIconSvg(readFileSync(join(BRAND, 'symbol.svg'), 'utf8'))

// Windows and Linux: full bleed. macOS: Apple's rounded square with margins.
mkdirSync(join(BRAND, 'icons'), { recursive: true })
for (const size of LINUX_SIZES)
  writeFileSync(join(BRAND, 'icons', `${String(size)}x${String(size)}.png`), render(icon, size))
writeFileSync(join(BRAND, 'icon-1024.png'), render(icon, 1024))
writeFileSync(join(BRAND, 'icon.ico'), encodeIco(ICO_SIZES.map((size) => ({ size, png: render(icon, size) }))))
writeFileSync(join(BRAND, 'icon.icns'), encodeIcns(new Map(ICNS_SIZES.map((size) => [size, render(mac, size)]))))

writeFileSync(join(BRAND, 'document.svg'), `${documentIcon}\n`)
writeFileSync(
  join(BRAND, 'document.ico'),
  encodeIco(ICO_SIZES.map((size) => ({ size, png: render(documentIcon, size) }))),
)
writeFileSync(
  join(BRAND, 'document.icns'),
  encodeIcns(new Map(ICNS_SIZES.map((size) => [size, render(documentIcon, size)]))),
)
writeFileSync(join(BRAND, 'document-512.png'), render(documentIcon, 512))

console.log(`Wrote icon sets to ${BRAND}`)
