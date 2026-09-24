/** Starting points inserted as new blocks (SPEC 6.6). Every snippet only uses bundled sounds. */
export interface Snippet {
  label: string
  code: string
}

export const SNIPPETS: Snippet[] = [
  { label: 'Four on the floor', code: '$: s("bd*4, ~ cp ~ cp, hh*8").bank("MotifKit")' },
  {
    label: 'Acid bass',
    code: '$: note("c2 c2 eb2 c3 c2 g1 c2 bb1").s("sawtooth").lpf(sine.range(300, 2400).slow(2)).lpq(14)',
  },
  { label: 'Arpeggio', code: '$: n("0 2 4 7 4 2").scale("C:minor").s("triangle").fast(2).room(0.3)' },
  { label: 'Glitch', code: '$: s("hh*16").chop(2).degradeBy(0.4).speed("<1 2 -1>").crush(6)' },
]
