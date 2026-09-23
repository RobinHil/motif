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
