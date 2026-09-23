# Motif - functional specification

Version 1.0 - functional reference. Architecture rules are in `CLAUDE.md`, delivery order in `PHASES.md`, visuals in `DESIGN.md`.

---

## 1. Vision

Motif is a complete composition instrument, approachable for a beginner, with no ceiling for an advanced user, that exploits Strudel's capabilities to the fullest.

### Guiding principles

1. **Every visual action writes Strudel code, and that code is always visible.** Users learn Strudel by using the interface.
2. **Nothing is locked away.** Anything the interface cannot represent is still possible as "free code", playable, mixable and arrangeable like everything else.
3. **Progressive disclosure.** The main screen is enough to build a loop. Advanced features are one click away, never forced on the user.
4. **The music never stops by accident.** Code error, scene change, reload: playback continues.
5. **Fully self-contained.** Works offline, nothing else to install.

### Audience

Beginners in music and live coding first, without ever limiting experienced users.

### Out of scope for v1

VST/AU plugins, microphone or audio input recording, online collaboration, public web version, MIDI clock sync with other software, pitch-preserving time-stretch.

---

## 2. Strudel concepts to know

- **Cycle**: Strudel's unit of time. By default, 1 cycle = 1 bar of 4 beats. Tempo is set with `setcpm(bpm / 4)`.
- **Mini-notation**: the pattern string language. `"bd ~ sd ~"` = 4 equal steps, `~` = rest, `*n` = repeat, `<a b>` = alternate one element per cycle, `[a b]` = subdivision, `a@2` = weight (double length), `a?` = 50% chance to play, `,` = layering.
- **`$:`**: declares an independent pattern. `_$:` mutes it.
- **Orbit**: output channel. Reverb and delay are shared per orbit. Project rule: **one track = one orbit**.
- **Signals**: `sine`, `tri`, `saw`, `isaw`, `square`, `perlin`, `rand`... usable as the value of any parameter, with `.range(min, max)` and `.slow(n)`.

Every API mentioned here must be checked against the source of the installed `@strudel/*` packages. If they differ, follow the rule in `CLAUDE.md` (log in `docs/DECISIONS.md`).

---

## 3. Data model

The project is a TypeScript object serialized to JSON. The types below are the target; adjust if needed and document the change.

```ts
type ID = string; // nanoid

interface Project {
  version: 1;
  meta: { name: string; createdAt: string; updatedAt: string };
  transport: { bpm: number; beatsPerCycle: number }; // default 120, 4
  tracks: Track[];
  scenes: Scene[];
  arrangement: ArrangementBlock[];
  automations: Automation[];
  master: MasterSettings;
  sampleLibrary: SampleEntry[];
  midiMappings: MidiMapping[];
}

type TrackKind = 'steps' | 'notes' | 'code';

interface Track {
  id: ID;
  name: string;
  color: TrackColor;            // token from DESIGN.md
  orbit: number;                // unique per track, 1..n
  kind: TrackKind;
  mute: boolean;
  solo: boolean;
  source: SoundSource;
  params: TrackParams;
  transforms: TransformInstance[];
  steps?: StepContent;          // when kind = 'steps'
  notes?: NoteContent;          // when kind = 'notes'
  code?: string;                // when kind = 'code': raw Strudel code, without '$:' or '.orbit()'
}

type SoundSource =
  | { type: 'bank'; bank: string }              // e.g. 'RolandTR909' (drum tracks)
  | { type: 'synth'; name: string }             // 'sawtooth', 'square', 'triangle', 'sine'...
  | { type: 'sample'; name: string }            // bundled or imported sample
  | { type: 'soundfont'; name: string };        // if soundfonts are bundled

type ParamValue = number | Modulation;

type Modulation =
  | { kind: 'signal'; shape: 'sine' | 'tri' | 'saw' | 'isaw' | 'square' | 'perlin' | 'rand';
      min: number; max: number; cycles: number }
  | { kind: 'sequence'; values: number[] };      // -> "<v1 v2 v3>"

interface TrackParams {
  gain: ParamValue;        // 0..1.5, default 0.8
  pan: ParamValue;         // 0..1, default 0.5
  lpf?: ParamValue;        // Hz, absent = filter open
  lpq?: ParamValue;        // resonance
  hpf?: ParamValue;
  room?: ParamValue;       // reverb, 0..1
  size?: ParamValue;       // reverb size
  delay?: ParamValue;      // 0..1
  delaytime?: ParamValue;
  delayfeedback?: ParamValue;
  shape?: ParamValue;      // saturation 0..1
  crush?: ParamValue;      // bitcrush, 1..16
  coarse?: ParamValue;
  speed?: ParamValue;      // sample playback speed
  vowel?: string;
  attack?: ParamValue; decay?: ParamValue; sustain?: ParamValue; release?: ParamValue;
  begin?: ParamValue; end?: ParamValue;  // sample region, 0..1
}

interface TransformInstance {
  id: ID;
  type: 'fast' | 'slow' | 'rev' | 'jux' | 'ply' | 'degradeBy' | 'sometimes'
      | 'lastOf' | 'chop' | 'striate' | 'slice' | 'loopAt' | 'custom';
  args: Record<string, number | string>;
  enabled: boolean;
}

interface StepContent {
  stepsPerCycle: 16;                 // 8, 16 or 32 later
  rows: StepRow[];
}
interface StepRow { id: ID; sound: string; variant?: number; steps: (Step | null)[] }
interface Step { velocity: number; probability: number } // 0..1

interface NoteContent {
  mode: 'note' | 'degree';           // note("c3") or n(0).scale("C:minor")
  scale?: string;                    // e.g. 'C:minor', required when mode = 'degree'
  stepsPerCycle: 16;
  notes: Note[];
}
interface Note {
  id: ID;
  step: number;                      // start position
  length: number;                    // in steps
  pitch: string | number;            // 'c3' or degree 0..n
  velocity: number;
  probability: number;
  alternatives?: (string | number)[]; // per-cycle variations -> "<p a1 a2>"
}

interface Scene { id: ID; name: string; lengthCycles: number; activeTrackIds: ID[] }
interface ArrangementBlock { id: ID; sceneId: ID; startCycle: number }
interface Automation { id: ID; target: { trackId: ID | 'master'; param: keyof TrackParams };
                       points: { cycle: number; value: number }[] }

interface MasterSettings { gain: number; compressor: boolean; limiter: boolean }
interface SampleEntry { name: string; files: string[]; origin: 'bundled' | 'user'; folder?: string }
interface MidiMapping { deviceName: string; channel: number; cc: number;
                        target: { trackId: ID | 'master'; param: string } }
```

### File format

- A project is a **folder**: `MySong.motif/` containing `project.json` and `samples/` (copies of the imported samples it uses). The `.motif` folder is registered as a document type so it opens in Motif from the file manager where the OS allows it.
- The `version` field drives migrations (`model/migrations.ts`), which are tested.
- Autosave every 30 seconds to a recovery file, restored after a crash.

---

## 4. Code generation (`codegen/`)

Pure function:

```ts
generateProjectCode(project: Project, options?: { sceneId?: ID }):
  { code: string; lineMap: Record<ID, { from: number; to: number }> }
```

`lineMap` is used to attach errors and highlighting to the right track.

### Rules

1. First line: `setcpm(${bpm}/${beatsPerCycle})`, then an empty line.
2. One track = one block starting with `$: ` (or `_$: ` when muted).
3. **Solo**: if at least one track is soloed, every other track is generated with `_$: `.
4. Order within a block: pattern source, `.bank()` or `.s()`, `.scale()`, parameters (fixed order of `TrackParams`), transforms (list order, `enabled` only), then `.orbit(n)`.
5. Parameters at their default value are not written.
6. Numbers: at most 3 decimals, no trailing zeros (`0.5`, not `0.500`).
7. Signal modulation: `sine.range(300, 1200).slow(4)`. `.slow(1)` is omitted.
8. Sequence modulation: `"<200 800 1200 400>"`.
9. `code` tracks: the code is inserted verbatim after `$: `, followed by `.orbit(n)`. The track's mixer parameters are appended after the free code.

### Step tracks

Each row becomes a layer separated by a comma inside a multi-line string (backticks), with a 2-character token per step to keep columns aligned:

```js
$: s(`bd ~  ~  ~  ~  ~  ~  ~  bd ~  bd ~  ~  ~  ~  ~ ,
      ~  ~  ~  ~  sd ~  ~  ~  ~  ~  ~  ~  sd ~  ~  ~ ,
      hh ~  hh ~  hh ~  hh ~  hh ~  hh ~  hh ~  hh hh`).bank("RolandTR909").orbit(1)
```

- Sample variant: `bd:3`.
- Probability < 1: `bd?0.3`.
- Non-uniform velocities: `.velocity("...")` with an aligned pattern, only when at least one step differs from 1.

### Note tracks

- 16-position grid. Rest: `~`. Note longer than one step: weight `@n`. Simultaneous notes: `[c3,eb3,g3]`.
- Per-cycle alternatives: `<5 7>` at the relevant position.
- `note` mode: `note("c3 ~ eb3@2 ...")`. `degree` mode: `n("0 ~ 2@2 ...").scale("C:minor")`.

Expected example:

```js
$: n("0 2 4 <5 7> ~ 4 2 ~").scale("C:minor").s("triangle").room(0.4).jux(rev).orbit(3)
```

### Transforms

| Type | Generated code | UI label |
|---|---|---|
| fast | `.fast(2)` | Speed up x2 |
| slow | `.slow(2)` | Slow down x2 |
| rev | `.rev()` | Play in reverse |
| jux | `.jux(rev)` | Widen stereo |
| ply | `.ply(2)` | Double every note |
| degradeBy | `.degradeBy(0.3)` | Drop 30% at random |
| sometimes | `.sometimes(x => x.speed(2))` | Sometimes higher |
| lastOf | `.lastOf(4, x => x.fast(2))` | Faster every 4th cycle |
| chop | `.chop(8)` | Chop into 8 |
| striate | `.striate(4)` | Interleave |
| slice | `.slice(8, "0 2 1 3")` | Replay slices |
| loopAt | `.loopAt(2)` | Fit to 2 cycles |
| custom | user's free code | Custom transform |

Arguments are editable in the UI (small field next to the label).

### Required tests

Snapshots for: empty project, each track kind, mute, solo, each transform, each modulation shape, sequence, probabilities, velocities, alternatives, long notes, chords, free code, parameter order, number rounding.

---

## 5. Audio engine (`engine/`)

- Initializes Strudel (web REPL + superdough) without any remote resource. Built-in synths and local samples are registered at startup.
- `engine.evaluate(code)`: evaluates the full code. UI changes trigger a re-evaluation **debounced by about 150 ms**.
- Evaluation failure: the previous pattern keeps playing, the error (message, line) is published and linked to a track through `lineMap`.
- Transport: play, stop (`hush`), current position in cycles exposed for the playhead (read with `requestAnimationFrame`, no events pushed to React).
- Played events: lightweight bus (callbacks or ring buffer) consumed by highlighting and meters.
- **Analysis**: a tap on the master output feeds an `AnalyserNode` (spectrum, scope, levels). **[SPIKE]** in phase 0: how to cleanly tap superdough's output. Same per orbit for track meters if possible, otherwise estimate from events.
- Audio output: output device selection (`setSinkId` on the AudioContext in Chromium), latency setting.
- Panic command `Ctrl+.`: stops everything immediately.

---

## 6. Screens

Six screens, reachable from the tabs in the top bar and shortcuts `1` to `6`. See `docs/mockups/`.

### 6.0 Transport bar (every screen)

Motif logo with the tagline "powered by Strudel", play, stop, record, loop, tempo (click to edit, drag vertically to adjust), position in cycles with 4 progress segments, tabs, "Offline · bundled samples" indicator, Export button.

### 6.1 Studio (main screen)

**Sound browser (left)**: search, category filters (All, Drums, Synths, Instruments, Textures, My samples), drum banks, sound list with one-click preview, folder drop zone. Dropping a sound on a track assigns it; on a grid row, it replaces the row's sound.

**Tracks (center)**: one row per track with color swatch, name (double-click to rename), kind and orbit, M and S buttons, level meter. Content depends on kind:
- `steps`: 16-step grid per row, grouped by 4, visible playhead. Click = toggle. Right-click a step = velocity, probability, variant. Horizontal drag = paint several steps. "+ Row" button.
- `notes`: mini piano roll preview, "Open piano roll" link.
- `code`: excerpt of the free code, dashed border, "Free code block" label.

"+ Add track" button: Rhythm, Notes, Free code. Drag and drop to reorder. Context menu: duplicate, delete, convert to free code, change color.

**Code (bottom)**: full generated code, selected track's lines highlighted. Two modes: "Synced" (read-only, mirrors the UI) and "Direct edit" (see 6.6). Full-screen link.

**Inspector (right)**: selected track. Sound source, 8 knobs (volume, pan, filter, resonance, reverb, delay, saturation or bitcrush, speed), "Animate a knob" link, list of transforms as toggles showing their code.

**Knob behavior (everywhere in the app)**: vertical drag, `Shift` for fine control, double-click to reset to default, mouse wheel, keyboard entry after clicking the value, right-click for the menu (Animate, Freeze, MIDI learn, Reset). A modulated parameter shows an arc in the modulation color and moves during playback.

### 6.2 Mixer

One strip per track plus a Master strip. Each strip: name and orbit, stacked effects (reorderable, bypassable, "+ Add effect"), reverb and delay sends, pan, fader with stereo meter, value, M/S, MIDI badge when mapped, generated mixer code.

Output panel: spectrum, oscilloscope, recording (format, stems per orbit, offline render), "Record output" button.

**MIDI learn mode**: explanation banner, mappable controls outlined with dashes. Click a control then move a hardware control = mapping. Done button.

### 6.3 Piano roll

Toolbar: "Notes (note)" or "Scale degrees (n + scale)" mode, scale, snap to scale, grid (1/16, 1/8, triplets), pencil, select and eraser tools.

Main area: vertical keyboard (2 octaves visible, scrollable), out-of-scale rows dimmed, resizable notes, playhead. Velocity lane below. "Edit cycle" selector (Cycle 1, Cycle 2, ..., All) to create alternatives; an alternative note is shown dashed on the other cycles.

Right panel: note properties (pitch, length, velocity, probability), "Vary per cycle" box, variation tools (humanize, transpose, arpeggiate a chord), generated code with the relevant part highlighted.

Shortcuts: `Ctrl+A`, `Ctrl+C/V`, `Delete`, arrows to move, `Shift+arrows` to transpose by an octave.

### 6.4 Modulation

Opens from the "Animate" right-click on any knob. Context panel (track, knobs with the animated one highlighted, list of parameters already animated in the project). Main panel: 8 shapes (Sine, Triangle, Ramp, Reverse ramp, Square, Perlin, Random, Sequence) each with a one-sentence explanation, curve preview over 4 cycles, low value, high value, cycle length (1, 2, 4, 8, 16 cycles), highlighted generated code. For Sequence: per-cycle value editor.

### 6.5 Arrangement

**Scenes**: cards showing name, active tracks (colored dots) and length. "Capture current state" creates a scene from the unmuted tracks.

**Two modes:**
- **Song**: timeline ruled in cycles, section row, one lane per track with its clips, automation lanes. Drag to move and resize sections. Generates `arrange([8, intro], [16, verse], ...)` with one `stack(...)` constant per scene.
- **Live**: clicking a scene queues it for the start of the next cycle ("next" state), the playing scene is marked "playing". **[SPIKE]**: trigger re-evaluation exactly on the cycle boundary using the scheduler position.

**Automation**: point-based curve on a track or master parameter. **[SPIKE]**: generation strategy (per-cycle value pattern `"<...>"` interpolated per segment, or composed signal); pick the most faithful and document it.

### 6.6 Code editor

Sidebar: tracks with their line number (click = go to line), snippets (Four on the floor, Acid bass, Arpeggio, Glitch, extensible), visualizations (live highlighting, punchcard, piano roll, spectrum).

CodeMirror editor: Strudel syntax highlighting, live highlighting of the mini-notation elements being played, autocompletion of Strudel functions with their category, documentation in the right panel (signature, description, playable example, "see also"), `Ctrl+Enter` to evaluate.

Console: errors with line number and a fix suggestion based on edit distance against known function names (e.g. `lfp` → `lpf`), Fix button. Reminder: "Other tracks keep playing".

**Reading code back into the UI**: when a structured track is edited by hand in direct edit mode, the app tries to parse it back. If the code matches the canonical format of `codegen/` exactly (dedicated, tested parser), the model is updated. Otherwise, offer "Convert to free code" (default) or "Undo the change". Never silently lose an edit.

The in-app documentation is a local JSON file (`resources/docs/functions.en.json`): name, category, signature, description, example, see also. Start with the 60 most useful functions and grow it across phases.

---

## 7. Samples

### Bundled

- Drum packs (drum machine banks), basic sounds and a few instruments, copied into `resources/samples/` with their manifests.
- **Check the license of every pack** before bundling it and record it in `resources/samples/LICENSES.md`. Drop any pack with an unclear license.
- Served through the custom `motif-sample://` protocol registered in the main process (`protocol.handle`, privileges `standard`, `secure`, `supportFetchAPI`, `stream`).

### User imports

- Drag and drop a file or folder onto the sound browser, or use the Import menu.
- Formats: whatever Chromium decodes (at least WAV, MP3, OGG, FLAC). Explicit rejection of anything else.
- Each file is registered through `samples()` under a name derived from its filename (normalized, no spaces); files from the same folder form one sound with variants (`name:0`, `name:1`...).
- Samples used by a project are **copied** into the project's `samples/` folder so the project stays complete.
- Warning above 60 seconds of duration (samples are fully loaded into memory).

### Sample editor

Waveform of the selected sample: start and end handles (`begin`, `end`), split into N visible slices (`slice`, `splice`, `chop`), "Fit to tempo" button (`loopAt`) with a warning that pitch changes with speed. Preview of each slice.

---

## 8. MIDI

- Web MIDI in the renderer, permission granted in the main process.
- Device list in settings, automatic reconnection.
- MIDI learn on every continuous control (knobs, faders, tempo).
- Note input: playing a MIDI keyboard previews the selected track's instrument; while recording, notes are written into the piano roll, quantized to the grid.
- MIDI output (driving external hardware): later phase.

---

## 9. Export

- **v1**: real-time recording of the master output to WAV (48 kHz, 24-bit by default), over a chosen length (in cycles or the full arrangement).
- **Stems**: one file per orbit, **[SPIKE]** depending on whether per-orbit tapping is feasible.
- **Offline render**: later phase, **[SPIKE]** (OfflineAudioContext with superdough).
- Code-only export (`.js`) usable in the online Strudel REPL.

---

## 10. Cross-cutting

### Undo / redo

History on the project model (not on UI state). Continuous gestures (dragging a knob) form a single entry. At least 200 levels.

### Global shortcuts

| Shortcut | Action |
|---|---|
| Space | Play / stop |
| Ctrl+. | Panic (stop everything) |
| Ctrl+Enter | Evaluate code |
| Ctrl+Z / Ctrl+Shift+Z | Undo / redo |
| Ctrl+S / Ctrl+O / Ctrl+N | Save / open / new project |
| 1 to 6 | Switch screen |
| M / S | Mute / solo selected track |
| Ctrl+D | Duplicate track |
| ? | Shortcut help |

On macOS, `Ctrl` becomes `Cmd`.

### Settings

Audio output device, latency, MIDI devices, sample library folder, UI scale (zoom), language (English only in v1, architecture ready for i18n).

### Onboarding

- Demo project loaded on first launch (the one from the mockups: Drums, Bass, Lead, Texture).
- Tooltips on every control showing the matching Strudel code.
- Home screen: Motif logo lockup with the "Powered by Strudel" tagline, New project, Open, Recent projects, Demo.

### Performance

- UI at 60 fps during playback with 8 active tracks.
- No audio glitches during UI interaction.
- App startup under 3 seconds on a recent machine.
- Measure with the React profiler and Chromium's Performance panel before signing off a phase.

### Accessibility

Real `button`, `input`, `label` elements. Keyboard navigation in every panel. `aria-label` on icon buttons. Contrast as defined in `DESIGN.md`.

### License

Strudel is licensed under **AGPL-3.0**, so this project is too. `LICENSE` file at the root, mention in the About window, list of dependency and sample licenses. The About window credits Strudel and TidalCycles and links to their projects.
