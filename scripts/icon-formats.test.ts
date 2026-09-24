import { describe, expect, it } from 'vitest'
import { documentIconSvg, encodeIcns, encodeIco, macIconSvg, svgInner } from './icon-formats'

const png = (n: number) => new Uint8Array(n).fill(7)

describe('icon containers', () => {
  it('writes an ICO directory pointing at each PNG', () => {
    const ico = encodeIco([
      { size: 16, png: png(10) },
      { size: 256, png: png(20) },
    ])
    expect(ico.readUInt16LE(2)).toBe(1)
    expect(ico.readUInt16LE(4)).toBe(2)
    expect(ico.readUInt8(6)).toBe(16)
    expect(ico.readUInt8(22)).toBe(0) // 256 is written as 0
    expect(ico.readUInt32LE(6 + 12)).toBe(38)
    expect(ico.readUInt32LE(22 + 12)).toBe(48)
    expect(ico.length).toBe(38 + 30)
  })

  it('writes ICNS entries with big-endian lengths', () => {
    const icns = encodeIcns(new Map([[16, png(10)]]))
    expect(icns.toString('ascii', 0, 4)).toBe('icns')
    expect(icns.readUInt32BE(4)).toBe(icns.length)
    expect(icns.toString('ascii', 8, 12)).toBe('icp4')
    expect(icns.readUInt32BE(12)).toBe(18)
  })

  it('nests the artwork for the macOS and document icons', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle r="1"/></svg>'
    expect(svgInner(svg)).toBe('<circle r="1"/>')
    expect(macIconSvg(svg)).toContain('<rect x="100" y="100" width="824" height="824" rx="185"/>')
    expect(documentIconSvg(svg)).toContain('<circle r="1"/>')
  })
})
