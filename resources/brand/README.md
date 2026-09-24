# Motif brand

The Motif symbol is **Cycle**: six dots on a ring. The accent dot starts the cycle and the following dots grow, like a motif that evolves each time it loops, which is how a Strudel pattern plays.

## Files

| File                                   | Use                                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| `symbol.svg`                           | The symbol alone, on dark backgrounds (default)                                     |
| `wordmark.svg`                         | "motif." in Geist 500, tracking -0.03em, period in accent                           |
| `lockup-horizontal.svg`                | Symbol and wordmark, for the transport bar                                          |
| `lockup-tagline.svg`                   | Symbol, wordmark and "powered by Strudel", for the home screen and the About window |
| `*-light.svg`                          | Same, for light backgrounds                                                         |
| `*-mono-white.svg`, `*-mono-black.svg` | Single-color versions                                                               |
| `icon.svg`                             | App icon master: the symbol on `bg-deep`, full bleed (1024 x 1024)                  |

All files are plain SVG: circles and paths, no embedded bitmap, text converted to paths. Colors are the design tokens `text` (#EDEDEF), `accent` (#D8B77A) and `bg-deep` (#08080A), plus `label` (#7E7E87) for the tagline on dark backgrounds. The icon sets (`.icns`, `.ico`, Linux PNGs) are generated from `icon.svg` when packaging is finalized.

## Rules

- **Minimum size**: the symbol at 16 px, the horizontal lockup at 16 px high, the tagline lockup at 24 px high (below that, use the horizontal lockup).
- **Clear space**: keep empty space around the symbol or a lockup equal to the diameter of the accent dot at the used size.
- **Backgrounds**: the default versions on dark surfaces (`bg-deep` to `raised`), the light versions on light surfaces, the single-color versions on photos or when only one ink is available.
- **Do**: scale proportionally; use the files as they are.
- **Do not**: recolor the dots, move the accent dot, make all dots the same size, animate the symbol as a loading spinner, rotate it, add shadows, outlines or gradients, set "motif." in another typeface, or change the tagline.

The Motif name and logo are not covered by the AGPL (see the project README).
