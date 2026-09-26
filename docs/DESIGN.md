# Motif - design system

Direction: dark studio, premium and minimal. Few borders, near-invisible hairlines, a single warm accent, desaturated track colors. Visual reference: screenshots in `docs/mockups/`.

## Colors

### Surfaces

| Token | Value | Usage |
|---|---|---|
| `bg-deep` | `#08080A` | Transport bar, window background |
| `bg-app` | `#0C0C0E` | Main screen background |
| `bg-code` | `#0A0A0C` | Code areas, inputs, visualization backgrounds |
| `panel` | `#111113` | Side panels, mixer strips |
| `raised` | `#141416` | Buttons, cards |
| `raised-2` | `#161618` | Cells, list rows |
| `active` | `#1D1D21` | Active or pressed element |
| `selected-row` | `#131315` | Selected track |
| `line` | `rgba(255,255,255,0.06)` | Default hairlines and borders |
| `line-strong` | `rgba(255,255,255,0.10)` | Secondary button borders |

### Text

| Token | Value | Usage |
|---|---|---|
| `text` | `#EDEDEF` | Primary text |
| `text-2` | `#8A8A93` | Secondary text |
| `label` | `#7E7E87` | Uppercase section titles |
| `text-3` | `#55555D` | Line numbers, decorative elements |

### Accent and states

| Token | Value | Usage |
|---|---|---|
| `accent` | `#D8B77A` | Play, selected tab, links, level peaks |
| `accent-hover` | `#E9CD96` | Hover |
| `mod` | `#86C5B8` | Modulated parameter (arc, curve, code) |
| `mod-bg` | `#121C1A` | Active modulation element background |
| `danger` | `#D9695F` | Record, active mute, errors |
| `success` | `#7DBF8E` | Offline indicator |

### Track colors

Assigned in order, then cycled:

| Token | Value | Name |
|---|---|---|
| `track-1` | `#D8B77A` | Sand |
| `track-2` | `#86C5B8` | Sage |
| `track-3` | `#AFA8E0` | Lavender |
| `track-4` | `#D89A88` | Clay |

Extend to 8 hues with the same lightness and saturation (e.g. steel blue, olive, dusty rose, warm grey), to be validated visually.

### Code highlighting

| Element | Value |
|---|---|
| Functions | `#BDB6E8` |
| Strings | `#D9BE8E` |
| Numbers | `#8FCBC1` |
| Comments | `#787882` |
| Playing element | 2 px outline in the track color |

### Contrast

Body text at least 4.5:1 against its background, large text (24 px and up) at least 3:1. The tokens above meet these thresholds on `panel` and `bg-app`; any new pairing must be checked.

## Typography

- **UI**: Geist (300, 400, 500, 600), fallback stack `'Helvetica Neue', system-ui, sans-serif`
- **Code and values**: Geist Mono (400, 500), fallback stack `'SF Mono', ui-monospace, monospace`
- Fonts **bundled locally** (no calls to Google Fonts)

| Role | Size | Weight | Notes |
|---|---|---|---|
| Screen title | 20 px | 500 | |
| Track name | 15 px | 500 | |
| Body | 13 to 14 px | 400 | |
| Small text | 12 px | 400 | `text-2` |
| Section title | 10.5 px | 500 | uppercase, letter-spacing 0.14em, `label` |
| Knob values | 11 px mono | 400 | |
| Code | 12.5 to 14 px mono | 400 | line height 20 to 24 px |

Weights stay light: 600 at most, reserved for exceptional cases.

## Shape and spacing

- 4 px spacing grid (4, 8, 12, 16, 20, 24, 32).
- Radii: 5 to 7 px for small controls, 8 px for inputs, 14 px for panels, 999 px for pills (tabs, transport buttons).
- Borders: 1 px `line`, never thicker except for focus and selection states (2 px).
- No drop shadows, no decorative gradients. Depth comes only from surface differences.

## Reference components

**Knob**: 48 px (40 px in the mixer), 270° arc open at the bottom, track in `line`, 2.5 px value arc in the track color or `mod` when modulated, core `#1B1B1E`. Label below, then the value in mono.

**StepButton**: 30 x 26 px, 7 px radius. Off: `#19191C`, and `#202023` on downbeats (1, 5, 9, 13). On: track color. Currently playing step: 2 px outline `rgba(237,237,239,0.45)`. 8 px gap every 4 steps.

**Fader**: 6 px rail in `bg-code`, 36 x 22 px thumb, stereo meter on the left in white at 55% opacity.

**Pill / Tab**: 32 to 36 px high, 999 px radius, active state `rgba(255,255,255,0.07)` with `text` color.

**Primary button**: `accent` background, `bg-app` text. Secondary button: transparent, `line-strong` border. Destructive button: transparent with a `danger` dot, never a solid red fill.

**Transform toggle**: 34 px row, label on the left, code in mono on the right (`label` when off, track color when on).

**Visualizations**: monochrome (white at 30 to 70% opacity), accent only on peaks and low frequencies.

## Logo and brand identity

Motif needs a **custom, original logo**, designed specifically for the project. No stock icon, no generic music symbol (note, waveform, headphones), no resemblance to the logos of Strudel, TidalCycles, FL Studio or any other music software.

### Current wordmark (placeholder)

"motif." in Geist 500, tight letter-spacing (-0.03em), the period in `accent`. The tagline "powered by Strudel" sits to its right in 11 px `label` color. This is only a starting point: the final wordmark may be redrawn.

### What to design

1. **Symbol**: a standalone mark that works without text, readable down to 16 px. Ideas to explore: a motif repeated around a circle (the cycle), the accent period as a seed that repeats, stacked layers. Geometric and minimal, consistent with the rest of the design system.
2. **Wordmark**: final "motif" lettering.
3. **Lockups**: symbol + wordmark (horizontal), and symbol + wordmark + "powered by Strudel" for the home screen and About window.
4. **App icon**: the symbol on a `bg-deep` background, following each OS's icon guidelines (macOS rounded square with its own margins, Windows and Linux full-bleed).

### Constraints

- Hand-written, clean **SVG** sources (no embedded bitmaps, text converted to paths).
- Colors from the tokens only: `accent`, `text`, `bg-deep`.
- Variants: on dark background (default), on light background, single-color (white and black).
- Recognizable at 16, 32, 128 and 1024 px.

### Deliverables (in `resources/brand/`)

- `symbol.svg`, `wordmark.svg`, `lockup-horizontal.svg`, `lockup-tagline.svg`, plus light and mono variants
- `icon.svg` (master for the app icon)
- Generated icon sets: `icon.icns` (macOS), `icon.ico` (Windows, 16 to 256 px), PNG set for Linux (16 to 512 px), 1024 px PNG
- `resources/brand/README.md`: minimum size, clear space, allowed and forbidden uses

### Process

Propose **3 distinct symbol directions** as SVG, each shown at 16, 32 and 128 px on the dark background, with one sentence explaining the idea. The owner picks one, then refine it and produce the deliverables. The logo is never final without the owner's explicit approval.

## Motion

Transitions of 120 to 180 ms, `ease-out`, only on opacity, color and transforms. Nothing animates layout. Respect `prefers-reduced-motion` for everything not tied to the music.

## UI copy

English, short sentences, sentence case, verbs on buttons. Every Strudel function label comes with its code. No em dashes or en dashes, plain hyphen `-` only. No emoji.
