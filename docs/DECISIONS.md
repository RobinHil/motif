# Technical decisions

Log of choices and findings made during development.
Format: date - problem - decision.

## 2026-09-23 - Toolchain versions

- **Problem**: the latest releases do not fit together. electron-vite 5.0.0 accepts vite 5 to 7 only (vite 8 is current), `@vitejs/plugin-react` 6 requires vite 8, and typescript-eslint accepts TypeScript below 6.1 (TypeScript 7 is current).
- **Decision**: pin vite 7.3, `@vitejs/plugin-react` 5.2 and TypeScript 6.0. Revisit when electron-vite 6 and a typescript-eslint release supporting TypeScript 7 are stable. TypeScript 6 deprecates `baseUrl`, so path aliases are declared relative to each tsconfig.

## 2026-09-23 - Electron binary download

- **Problem**: Electron 44 no longer ships a `postinstall` script. `bun install` leaves `node_modules/electron` without its binary.
- **Decision**: nothing to configure. The binary is downloaded on first use (`electron` CLI, electron-vite, electron-builder). CI runs `bun run build` before anything that needs the binary. Note for agents running inside VS Code: `ELECTRON_RUN_AS_NODE=1` is inherited from the editor and makes Electron start as plain Node; unset it before `bun run dev`.

## 2026-09-23 - Content Security Policy

- **Problem**: `@strudel/core` evaluates transpiled code with `Function(body)()` (`evaluate.mjs`), which a CSP without `'unsafe-eval'` blocks. superdough's build also inlines its AudioWorklet modules as `data:text/javascript` URLs.
- **Decision** (approved by the owner): `script-src 'self' 'unsafe-eval'`, no `data:` in `script-src`; superdough's worklets will be served as local files (see the engine entry). Everything else is `'none'` or `'self'`, plus `motif-sample:` for media and fetch. No remote host appears in the policy (unit test). The packaged renderer loads from `file://`, so the production CSP is injected as a meta tag at build time; in development the main process sends a looser header for Vite (inline scripts, HMR socket). Electron prints an "Insecure Content-Security-Policy" warning because of `'unsafe-eval'`; it only appears in unpackaged builds. A session-level `onBeforeRequest` filter also cancels every non-local request, as a second line of defense for rule 7.

## 2026-09-23 - AudioWorklet modules

- **Problem**: the published builds of superdough 1.3.0 and supradough 1.2.4 (pulled in by `@strudel/webaudio`) embed their AudioWorklet modules as `data:text/javascript;base64` strings passed to `audioWorklet.addModule`. The CSP has no `data:` in `script-src`.
- **Decision**: a Vite plugin (`scripts/vite-worklets.ts`) decodes each string and replaces it with a real file: emitted as an asset in production builds, served from `/@worklets/` by the dev server. The three packages are excluded from dependency pre-bundling, because pre-bundled code skips transform hooks. The plugin fails the build if the string disappears, so a Strudel upgrade cannot silently break it. Verified in dev and in the built app loaded from `file://`: worklets load, the test pattern plays.
- **Known gap**: superdough's `.dsp()` feature compiles user code into a worklet at runtime through another `data:` URL. It stays blocked by the CSP. Revisit if a phase needs it.

## 2026-09-23 - Sample protocol privileges

- **Problem**: the spec lists the privileges `standard`, `secure`, `supportFetchAPI` and `stream` for `motif-sample://`. The renderer (on `file://` or the dev server) fetches from it cross-origin.
- **Decision**: add `corsEnabled` and answer with `Access-Control-Allow-Origin: *`. The protocol only serves audio files and manifests from allowed roots, so this exposes nothing new. URLs have the form `motif-sample://<root>/<path>`; the only root in phase 0 is `bundled` (`resources/samples/`).

## 2026-09-23 - [SPIKE] Master output tap for analysis and recording

- **Question**: how to tap superdough's master output cleanly for an `AnalyserNode` (spectrum, scope, levels) and for recording.
- **Findings** (superdough 1.3.0): every orbit is summed by `SuperdoughOutput` into `output.destinationGain`, which is connected straight to `audioContext.destination`. The controller is reachable through `getSuperdoughAudioController()`. `destinationGain` is recreated only by `controller.reset()`, called by `resetGlobalEffects()` and by the offline renderer (`renderPatternAudio`). Changing the output device (`setSinkId`) does not touch the graph (not tested on a second device).
- **Prototype**: `engine/master-bus.ts` inserts a master bus in series: `destinationGain -> input -> output -> destination`, with the analyser (and later the recorder) fed from `output`. `ensureMasterBus()` is idempotent and re-inserts the bus if superdough replaced `destinationGain`. `engine/recorder.worklet.ts` is an AudioWorklet that posts 4096-frame chunks with their `currentFrame`, so dropped blocks are detected; `engine/wav.ts` encodes 16 or 24-bit PCM (unit tested).
- **Measurements** (dev app, test pattern, 48 kHz, driven through the DevTools protocol): analyser max RMS 0.46 while playing, 0 after stop. A 4-cycle recording at 0.5 cps gave exactly 384000 frames (8.000 s, equal to the AudioContext clock), 0 dropped frames, no silent gap, and a valid 24-bit stereo WAV. After `resetGlobalEffects()` the analyser read 0 until `ensureMasterBus()` ran again, then 0.48. The recorder worklet also loads from `file://` in a production build.
- **Rejected**: `MediaRecorder` on a `MediaStreamAudioDestinationNode` only produces compressed webm/opus in Chromium, so it cannot deliver the 24-bit WAV the spec requires without a lossy round trip.
- **Decision**: series master bus after `destinationGain`, re-checked with `ensureMasterBus()` before each evaluation and each analysis or recording session. Real-time WAV export uses the recorder worklet. Master processing (gain, compressor, limiter) goes between `input` and `output`, so the analyser and the recording see the final signal.

## 2026-09-23 - [SPIKE] Per-orbit analysis

- **Question**: can each track (one track = one orbit) get its own analyser for meters, and its own recording for stems, without estimating levels from events?
- **Findings** (superdough 1.3.0): `SuperdoughAudioController.getOrbit(n)` lazily creates an `Orbit` whose `output` GainNode carries the orbit's voices plus its own reverb, delay and ducking, before the master. Calling `getOrbit(n)` ahead of time is harmless (an idle gain node connected to the output). Orbit nodes are recreated only by `controller.reset()`, like `destinationGain`.
- **Prototype**: `engine/orbit-taps.ts` attaches an `AnalyserNode` (fftSize 512) in parallel to each orbit output, idempotently; `startRecording(source)` now records any node and reports its start frame.
- **Measurements** (dev app, 8 orbits with drums, synths, a delay and a reverb, orbit 3 muted with `_$:`):
  - Levels: every playing orbit read a positive max RMS (0.02 to 0.49), the muted orbit read exactly 0.
  - Main-thread cost of reading 8 analysers and computing RMS: median below 0.1 ms, p99 0.4 ms per animation frame.
  - Master plus 8 stems recorded simultaneously for 4 s: all 9 recorders started on the same frame, 0 dropped frames, and `AudioContext.playbackStats` reported 0 underruns.
  - Summing the 8 stems reproduces the master with a residual of -146.7 dB, i.e. identical within float rounding.
- **Decision**: per-orbit analysis is feasible and cheap, so track meters read real per-orbit analysers, not event-based estimates. Stems are validated for phase 10: one recorder worklet per orbit, aligned by start frame. Stems are pre-master (before the master bus processing), which is the usual definition. `playbackStats` is available in Electron 44 and will serve as the audio-glitch check in performance passes.

## 2026-09-23 - [SPIKE] Live highlighting

- **Question**: how does `@strudel/codemirror` highlight the mini-notation being played, which positions does the transpiler return, and can Motif reuse it?
- **Findings** (`@strudel/transpiler` 1.2.6, `@strudel/codemirror` 1.3.0):
  - `transpiler(code)` returns `miniLocations`, a list of `[start, end]` **absolute character offsets into the evaluated code**, one per mini-notation leaf, rests (`~`) included. Double-quoted strings and backtick strings without interpolation are both parsed as mini-notation, so the multi-line step grids of `codegen/` are covered: each row's tokens map to their own line. Offsets account for everything before them (the `setcpm` line).
  - Each played hap carries `hap.context.locations` (`{start, end}`) pointing at the tokens that produced it, including method arguments such as `"sawtooth"`.
  - `highlight.mjs` is small and depends only on `@codemirror/state` and `@codemirror/view`: on evaluation, `updateMiniLocations` stores one mark per location (CodeMirror remaps marks when the text is edited); every frame, `highlightMiniLocations(view, time, haps)` shows the marks whose hap is active. In the Strudel REPL the haps come from `@strudel/draw`'s `Drawer`, which queries `scheduler.pattern.queryArc(...)` in a `requestAnimationFrame` loop.
  - CodeMirror's style engine (`style-mod`) injects a `<style>` element into the document, which the production CSP (`style-src 'self'`) blocks: the editor loses its base theme. It only uses `adoptedStyleSheets` (allowed by the CSP) inside a shadow root. Decoration styles set through attributes are applied via `style.cssText` (CSSOM) and are not blocked.
- **Prototype** (throwaway, not committed): an EditorView fed with the repl's `miniLocations`, driven from a rAF loop that queries `repl.scheduler.pattern` around `scheduler.now()`. Measured in the production build with the production CSP: highlighting present on 240 of 240 frames, highlighted text exactly the played tokens, marks still on the right token after an edit, cost of query plus dispatch for two editors median 0.9 ms and p99 3 ms per frame. With the editor mounted in a shadow root: base theme applied and 0 CSP violations.
- **Regression test**: `engine/strudel-locations.test.ts` checks the offsets, the multi-line case and the hap locations, and that haps can be attributed to a track by offset range (the future `lineMap`). The Strudel repl needs a browser (kabelsalat), so the test uses `evaluate` from `@strudel/core` and registers `$:` blocks the way the repl does. Vitest inlines `@strudel/*` and `@kabelsalat/*`, whose `main` field points to UMD bundles.
- **Decision**:
  - Highlighting relies on transpiler offsets and `hap.context.locations`; a hap is attributed to a track by comparing its offsets with the track's range in `lineMap`.
  - Motif writes its own small extension instead of importing `@strudel/codemirror` (which pulls in themes, vim and emacs keymaps, nanostores and `@strudel/draw`): same StateField approach, but marks get a class per track color from the design tokens, as `DESIGN.md` requires ("2 px outline in the track color").
  - The active-hap query runs once per frame in the engine's rAF loop and is shared by all views; views are only updated when the active set changes.
  - CodeMirror editors are mounted in a shadow root, so the CSP stays free of `'unsafe-inline'` for styles. Design tokens are CSS custom properties and inherit into the shadow root; component styles are attached with `adoptedStyleSheets`.

## 2026-09-23 - Packaging and third-party licenses

- **Problem**: the brief does not name a packaging tool, and electron-builder has no Bun-specific dependency collector. Licenses of everything shipped must be listed.
- **Decision** (packaging tool approved by the owner): electron-builder (`electron-builder.yml`). The main and preload bundles only require `electron` and Node built-ins, and Vite bundles the whole renderer, so the app archive contains only `out/` and `package.json`: no `node_modules`, and Bun's install layout does not matter (no need for a hoisted linker). Samples, `LICENSE` and `THIRD_PARTY_LICENSES` go to `resources/` next to the archive; `motif-sample://bundled/` points to `process.resourcesPath/samples` when packaged. Targets: AppImage (Linux), NSIS (Windows), dmg (macOS); default Electron icon until phase 10. Verified on Linux: the AppImage plays the test pattern, loads Geist, serves samples, rejects traversal and blocks remote requests. Running an AppImage needs FUSE 2 (`fuse2` on Arch) or `--appimage-extract-and-run`.
- `package.json` uses `AGPL-3.0-or-later`, the license field of every installed `@strudel/*` package and of superdough.
- `scripts/third-party-licenses.ts` walks the production dependency tree from `node_modules` (Node resolution, works with Bun's layout), writes `THIRD_PARTY_LICENSES` with each package's license text plus the Geist OFL, and with `--check` fails on any license outside an AGPL-compatible allow list (SPDX expressions supported). The file is generated by `bun run package` and not committed, so it cannot go stale.

## 2026-09-23 - CI/CD setup

- **Dependency updates**: Dependabot (native to GitHub, supports `bun.lock` through the `bun` ecosystem), weekly, one group for packages and one for GitHub Actions. Renovate would need an app installation.
- **Bun version**: pinned through `packageManager` in `package.json`, read by `oven-sh/setup-bun` (`bun-version-file`).
- **Audit**: `bun audit` for vulnerabilities, `bun run licenses --check` for licenses (see "Packaging and third-party licenses"); general-purpose license checkers do not read `bun.lock`.
- **Coverage**: `@vitest/coverage-v8`, uploaded as a CI artifact. No threshold in phase 0; phase 1 requires more than 90% on `codegen/`.
- **Signing**: `package.yml` sets `CSC_IDENTITY_AUTO_DISCOVERY=false` and produces unsigned installers; signing arrives with `release.yml` in phase 10.
- **Branch protection** of `main` is a repository setting, applied by the owner in GitHub (required checks: the `CI` jobs).
- Actions are pinned by commit SHA with the version in a comment; `actionlint` reports no issue.

## 2026-09-23 - Model schema and validation

- **Problem**: projects are read from disk and may come from someone else, and codegen writes model strings into code that is executed.
- **Decision**: the model is a set of zod schemas (`model/project.ts`); TypeScript types are inferred from them, so types and load-time validation cannot drift apart. Every string that reaches generated code is constrained by a regular expression (sound and bank names, note names, scales, vowels), and codegen checks them again (`safeToken`), so a crafted project cannot break out of a mini-notation string. Free code tracks and custom transforms remain arbitrary code by design (see the untrusted-project warning). Cross-field rules are checked too: unique track ids, one orbit per track, content present for the track kind, a scale in degree mode, notes inside the cycle.

## 2026-09-23 - Code generation: gaps and contradictions in SPEC 4

- **Default gain**: SPEC 3 gives a default gain of 0.8, and SPEC 4 rule 5 says default values are not written. Together, a new track would show 0.8 but play at Strudel's default of 1. **Decision**: a parameter is omitted only when it equals Strudel's own default (`gain` 1, `pan` 0.5, `PARAM_DEFAULTS`), and new tracks start at gain 1. Headroom comes from the master gain, whose default stays 0.8. The demo lead line then matches the SPEC example exactly (no `.gain()`).
- **Order of `.scale()`**: rule 4 lists `.bank()`/`.s()` before `.scale()`, but the SPEC example and the phase 5 criterion write `n("...").scale("C:minor").s("triangle")`. **Decision**: follow the example: pattern, `.scale()`, sound, parameters, transforms, `.orbit()`.
- **Probability**: in mini-notation `bd?0.3` removes the event with probability 0.3; the model stores the chance to play. **Decision**: write `?` followed by `1 - probability` (probability 0.7 gives `bd?0.3`). Verified by evaluating the code: probability 0.25 plays about a quarter of the notes.
- **Velocities**: a layered `.velocity("1 0.5, 0.2 0.3")` gives every event the values of every layer (8 events instead of 4, verified). **Decision**: without velocity changes, step tracks use the SPEC multi-line string. When a velocity differs from 1, each row becomes its own `s(...)` with its own aligned `.velocity(...)` inside `stack(...)`. Note tracks do the same per voice, and chord members only share a chord when their velocity and probability are equal.
- **Note grid**: notes are written on the coarsest grid that keeps every onset (lengths divided by their greatest common divisor), which is how the SPEC example `n("0 2 4 <5 7> ~ 4 2 ~")` comes out of a 16-step grid. Notes that overlap without starting together go to separate comma-separated layers.
- **Solo and mute**: a track is muted if it is muted, or if another track is soloed and it is not. Mute wins over solo.
- **Sources**: step tracks name their sounds per row, so only a `bank` source is written for them. Free code tracks write no source.
- **Free code**: trimmed, then parameters, transforms and `.orbit()` are appended. If the last line holds a `//` comment, the suffix starts on a new line.
- **`lineMap`**: 1-based, inclusive line ranges per track. `generateProjectCode` also returns the `header` and each track's `blocks`, which the engine uses to isolate errors.
- **`sceneId`**: tracks outside the scene are muted rather than removed, so their orbits and effects stay allocated.

## 2026-09-23 - Undo history

- **Problem**: AGENTS.md suggests zundo "or equivalent". SPEC 10 wants continuous gestures (dragging a knob) to form a single undo entry. zundo can pause tracking, but cannot then record one entry from the state before the gesture to the state after it.
- **Decision**: a small history inside the project store (`store/project-store.ts`): immutable snapshots made with immer (structural sharing), `past` and `future` stacks capped at 500 entries, and `beginGesture()`/`endGesture()` that turn everything in between into one entry. Undo during a gesture ends it first. Named edits live in `store/actions.ts` as recipes, so every change to the model goes through the history. UI state (`ui-store`) and playback state (`transport-store`) are separate and not undoable. `amend()` applies bookkeeping changes (the save date) without an undo entry. Tested: 200 random edits then 200 undos give back the initial project object.

## 2026-09-23 - Engine: evaluation and errors

- **Problem**: golden rule 6 and SPEC 5 ask that a failing evaluation keeps the last valid pattern and attaches the error to the right track. `repl.evaluate` catches errors and reports them through `onEvalError`; runtime errors (`x.lfp is not a function`) carry no line number.
- **Decision**: `engine/evaluator.ts` checks each track block alone before evaluating the program (`check-block.ts`: transpile, evaluate without the `$:` label, query the first cycle). A failing block is replaced by that track's last valid block, so the other tracks still take their changes and the failing track keeps playing its previous version; the error is attached to the track, with a line when Strudel gives one (syntax errors). If Strudel still rejects the whole program, the previous pattern keeps playing (Strudel does not replace it) and the error is reported as global. Evaluations are debounced by 150 ms and never overlap. The evaluator has no Strudel dependency and is tested with a fake player plus the real block check; the acceptance scenario (breaking the demo's free code track) was also verified in the running app, where the output level stayed unchanged.
- `@strudel/tonal` is now installed and in the scope: `.scale()` comes from it.
- The main process enables `autoplayPolicy: 'no-user-gesture-required'`, so the engine can boot and evaluate before the first click; the AudioContext is resumed on play.
- The engine is still reached through the app layer only (`app/engine-bridge.ts`), which regenerates code on project changes, skips evaluation when the code is unchanged, and pushes results to the transport store.
- **Known gap**: the demo's drums use the `RolandTR909` bank from the SPEC, which is not bundled yet (packs arrive in phase 7). They are silent and superdough logs "sound not found" until then.

## 2026-09-23 - Project files and recovery

- **Problem**: project code runs in the renderer, so anything the preload exposes can be called by a malicious project.
- **Decision**: the main process only writes `project.json` (and creates `samples/`) inside a `.motif` folder chosen in a save dialog, or the folder the current project was opened from; the renderer never sends a path. Writes go through a temporary file and a rename. Payloads are limited to 50 MB. Opening a project that contains free code or custom transforms shows a native warning unless this installation saved that folder itself (list of trusted folders in userData). Crash recovery: the renderer autosaves unsaved changes every 30 seconds to a fixed file in userData; a lock file marks a running session, and finding it at startup means the previous session crashed, so the autosave is offered once and restored with a notice. A clean quit removes both files. Closing with unsaved changes asks for confirmation (`beforeunload` in the renderer, native dialog in the main process). Verified in the app: a hard kill after an edit restores the project on the next start, and a clean quit leaves nothing behind.

## 2026-09-23 - Phase 2 content choices

- **Tagline**: AGENTS.md writes "Powered by Strudel", DESIGN.md and the approved mockups write "powered by Strudel" next to the wordmark. **Decision**: follow the mockups; `APP_TAGLINE` is "powered by Strudel".
- **Bundled kit**: the mockups show the RolandTR909, TR808 and TR707 banks, which are not bundled (sample packs and their licenses are phase 7). **Decision**: the synthesized kit becomes MotifKit (`resources/samples/motif-kit/`, CC0): bd, sd, hh, cp, rim and a wind texture, registered both as plain sounds and as a Strudel bank (`MotifKit_bd`...). The demo and new rhythm tracks use `.bank("MotifKit")`, so they play today; they switch to a real drum machine bank once one is bundled. The demo otherwise follows the Studio mockup (bass with a filter swept by `sine.range(300, 1200).slow(4)`, the texture as free code on the wind sample).

## 2026-09-24 - Phase 2: Studio screen

- **Logo**: the owner picked **Cycle** among three directions. Refined so it does not read as a loading spinner: the accent dot starts the ring and the following dots grow. Files in `resources/brand/` (symbol, wordmark, lockups, light and mono variants, `icon.svg`), text converted to paths from Geist 500. The icon sets are generated at packaging time (phase 10).
- **Code panel**: CodeMirror 6, read-only, mounted in a shadow root (see "Live highlighting"): the base theme and the token colors apply under the production CSP. Synced mode only; "Direct edit" is visible and disabled until the code editor phase.
- **Screens not built yet** (Mixer, Piano roll, Modulation, Arrangement, Code) show a short placeholder with a way back; playback keeps running. Record, Loop and Export are visible and disabled with a tooltip.
- **First launch** opens the demo in the Studio (SPEC 10); later launches start on the home screen, unless a crash recovery restored a project. The flag lives in `localStorage`, a per-profile convenience.
- **Recent projects**: the main process keeps the folder paths and gives the renderer names and opaque ids only; opening a recent project goes through the same free code warning.
- **Keyboard**: Space plays and stops everywhere except in text fields, so buttons are activated with Enter; the step grid is one tab stop with arrow keys (roving focus); knobs are sliders (arrows, Page keys, Home/End, Delete to reset, Enter to type); context menus open with the Menu key or Shift+F10. Every drag and drop has a keyboard path ("Use" in the sound browser, row menu to swap a sound, Alt+arrows to reorder tracks).
- **Measurements** (dev app): 0 React commits during 5 seconds of playback without interaction (commits counted through a stand-in DevTools hook); 164 to 171 ms from a click, a mute or a knob change to the evaluated program (150 ms debounce plus evaluation). Strudel then applies the new pattern to events it has not scheduled yet, up to about 100 ms ahead.
- **End-to-end tests**: Playwright drives the built app (`_electron`) in a fresh profile (`MOTIF_E2E_USER_DATA`, read only when set by the launcher); tests quit with `app.exit` because an edited project would ask for confirmation. The zero-outbound-request test records every request of the renderer and asserts none is `http(s)` or `ws(s)`. The main process has no network code of its own, and the session filter blocks any other request anyway.

## 2026-09-24 - Phase 3: code editor and reading code back

- **Which block is which track**: every generated block ends with `.orbit(n)`, unique per track, so blocks are matched to tracks by their last `.orbit(n)`. A block without a known orbit becomes a new free code track; a track whose block disappeared is removed (one undoable step). Two blocks with the same orbit, or anything other than `setcpm(...)` above the first block, stop the read-back with a message and nothing is applied.
- **"Matches the canonical format"**: the block is parsed (`codegen/parse.ts`, acorn), the track is regenerated, and the result must equal the typed block, ignoring whitespace. The round trip is the actual check, so the parser can stay small and never accepts code it would write differently. Spacing inside the step grid can be broken freely.
- **Otherwise**: a dialog offers "Convert to free code" (default, focused) or "Undo the change". Converting keeps the typed text verbatim: only the leading `$:` and the final `.orbit(n)` are taken off, and the mixer parameters are reset because they are now in the code. Comment lines right above a block belong to it and are kept after the label (`$: // Drums` then the pattern). Free code tracks are updated directly; their mixer suffix stays on the track when it was left untouched.
- **Mute from the code**: `_$:` sets or clears a track's mute. A track silenced by another track's solo stays silenced whatever its prefix says.
- **Draft**: the text typed in the Studio's direct edit mode and in the code screen is one shared draft, so switching screens loses nothing. Typing does not evaluate; Ctrl+Enter (or Evaluate) reads the draft back, then evaluates.
- **Fix button**: unknown functions from Strudel errors are matched against the documented functions with an edit distance that counts swapped neighbors as one edit (lfp -> lpf). The fix applies to the draft when there is one, otherwise to the track's free code.
- **Reference**: 60 functions in `resources/docs/functions.en.json`. A test checks that each exists in the installed Strudel (`setcpm` and `setcps` come from the repl) and that each example plays events using only bundled sounds. "Play example" evaluates the example for 2 cycles in place of the project, then puts the project's program back.
- **Live highlighting** follows the SPIKE 3 decision: own CodeMirror extension, one mark per mini-notation position with the track color, active positions computed once per frame from the scheduler's current cycle. It only shows when the editor text is exactly the program being played. The outline can appear up to the audio output latency (about 50 ms here) before the sound.
- **Visualizations**: punchcard (events per orbit), piano roll (events per pitch) and spectrum (master analyser), drawn on canvas from the shared frame loop, two cycles around the playhead.
- **Completion**: CodeMirror's completion ignores Enter during the first 75 ms after the list opens, against accidental accepts; the end-to-end test waits accordingly.
- `acorn` is now a direct dependency (it was already installed through `@strudel/transpiler`).
