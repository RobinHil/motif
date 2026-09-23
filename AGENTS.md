# AGENTS.md - Motif

This file is read by coding agents at the start of every session (`CLAUDE.md` is a symlink to it). It holds the permanent rules of the project. Functional details live in `docs/`.

**App name: Motif.** Tagline: "Powered by Strudel", shown next to the logo, on the home screen and in the About window. Name, tagline and version are defined in a single place (`src/shared/app-info.ts`) and imported everywhere else. Project files use the `.motif` extension.

## The project in short

Motif is a desktop music production app in the spirit of FL Studio, built entirely on **Strudel** (the JavaScript port of TidalCycles). Users compose through a graphical interface (step sequencer, piano roll, mixer, modulation, arrangement) and every action generates Strudel code that is always visible and editable. A beginner can do everything with the mouse; an advanced user can do everything in code. Nothing is locked away.

The app is **100% self-contained**: no network access, nothing else to install, samples and fonts bundled.

**Everything in this project is in English**: UI, code, comments, commit messages, documentation.

Reference documents, to read before any task related to their topic:

- `docs/SPEC.md`: full functional specification, data model, code generation
- `docs/PHASES.md`: phased roadmap with acceptance criteria
- `docs/DESIGN.md`: design system (colors, typography, components, logo brief)
- `docs/mockups/`: screenshots of the 6 approved screens. **Not added yet**: they will be committed before phase 2. Do not look for them before then.
- `docs/DECISIONS.md`: log of technical decisions made during development
- `.github/workflows/`: CI/CD, see the CI/CD section below

## Stack

- **Bun**: package manager and script runner (development tool only). Bun is a deliberate choice for this project and overrides any global pnpm preference.
- **Electron** + **electron-vite**: the main process runs on the Node runtime bundled with Electron, not on Bun
- **React 19** + **TypeScript (strict)**
- **Vite** for the renderer
- **Tailwind CSS v4** via `@tailwindcss/vite`, tokens declared in `@theme`
- **Zustand** for state, **zundo** (or equivalent) for undo/redo
- **CodeMirror 6** for the code editor (reuse `@strudel/codemirror` where relevant)
- **Strudel**: `@strudel/*` packages and `superdough` (audio engine)
- **Vitest** for unit tests, **Playwright** (Electron mode) for end-to-end tests from phase 2 onward

If Bun causes packaging issues (because of its `node_modules` layout), switch installs to hoisted mode rather than changing tools.

Strudel's reference repository is on Codeberg (`codeberg.org/uzu/strudel`). Check real APIs in the source of the installed packages instead of assuming them.

## Commands

Keep up to date from phase 0:

```
bun install          # dependencies
bun run dev          # Electron app in development mode
bun run test         # unit tests (Vitest)
bun run test src/renderer/codegen/foo.test.ts   # a single test file
bun run test -t "test name"                     # a single test by name
bun run test:e2e     # end-to-end tests (Playwright)
bun run lint         # ESLint
bun run typecheck    # tsc --noEmit
bun run build        # production build
bun run package      # installers (Windows, macOS, Linux)
```

**Never run `bun test`** (Bun's built-in test runner). Always use `bun run test`, which runs Vitest.

## Architecture

This tree is the **target structure to create in phase 0**. Until then, the repository contains only `AGENTS.md`, `docs/` and the license: do not look for these folders before they exist.

```
src/
  main/              Electron main process (window, IPC, file system, sample protocol)
  preload/           contextBridge, minimal typed API
  shared/            code shared by main and renderer (app info, IPC types)
  renderer/
    app/             shell, screen routing, global shortcuts
    engine/          audio engine: Strudel, evaluation, scheduler, analysers. ZERO React imports
    model/           project types, defaults, version migrations
    codegen/         Strudel code generation from the model (pure functions)
    store/           Zustand stores (project, UI, transport), undo/redo
    screens/         studio, mixer, pianoroll, modulation, arrangement, code
    components/      reusable UI components (Knob, Fader, StepButton, Pill...)
    viz/             real-time canvas rendering (meters, spectrum, scope, playhead)
    midi/            Web MIDI, MIDI learn
    styles/          Tailwind, tokens, fonts
resources/
  samples/           bundled sample packs + manifests
  fonts/             Geist and Geist Mono, local files
  brand/             Motif logo, symbol, app icon sources and generated icon sets
  docs/              in-app function reference (functions.en.json)
docs/
```

## Golden rules (non-negotiable)

1. **The project model is the single source of truth.** The UI edits the model, the model generates code (`codegen/`), the engine evaluates the code. A track in "free code" mode stores its code verbatim in the model.
2. **React is never on the audio path.** The engine (`engine/`) imports nothing from React and never calls `setState`. No audio event may trigger a React re-render.
3. **Anything that moves at 60 fps is drawn on canvas** with `requestAnimationFrame` (meters, spectrum, scope, playhead, active-step highlighting). Real-time data flows through refs or shared buffers, never through state.
4. **Components subscribe only to what they display**: fine-grained Zustand selectors, never a subscription to the whole project.
5. **`codegen/` is pure and tested.** Same model in, same code out, byte for byte. Every generation rule has a test.
6. **A code error never stops the sound.** If evaluation fails, the last valid pattern keeps playing and the error is attached to the right track.
7. **No network access at runtime.** No fetch to the Internet, no remote font or sample. Everything lives in `resources/`.
8. **Strict TypeScript**, no `any` without a comment justifying it.
9. **Design follows `docs/DESIGN.md`.** No hard-coded color, radius or font outside the tokens.

## CI/CD

Hosted on **GitHub Actions** (if the repository lives on Codeberg or another Forgejo instance, port the same workflows to Forgejo Actions, the syntax is nearly identical). Workflows live in `.github/workflows/`.

### Workflows

| File | Trigger | Content |
|---|---|---|
| `ci.yml` | every push and pull request | `lint`, `typecheck`, `test` with coverage on Ubuntu, then `build` on a matrix Ubuntu / Windows / macOS |
| `e2e.yml` | pull requests and pushes to `main` (from phase 2) | Playwright in Electron mode on Ubuntu under `xvfb-run`, traces and screenshots uploaded on failure |
| `package.yml` | pushes to `main` | `bun run package` on the 3 OSes, installers uploaded as workflow artifacts (7-day retention) for manual testing |
| `release.yml` | tag `v*.*.*` | packages the 3 OSes, generates `SHA256SUMS`, creates a **draft** GitHub Release with installers and changelog |
| `codeql.yml` | pull requests + weekly | CodeQL analysis for JavaScript/TypeScript |
| `audit.yml` | weekly + changes to the lockfile | dependency vulnerability audit and license check (flag any license incompatible with AGPL-3.0) |

Dependency updates: Renovate or Dependabot (check that the chosen tool supports Bun's lockfile), grouped weekly, GitHub Actions included.

### Rules

- `main` is protected: merge only through pull requests with `ci.yml` (and `e2e.yml` once it exists) green.
- Workflows declare **minimal permissions** (`permissions: contents: read` by default, `contents: write` only in `release.yml`).
- Third-party actions are **pinned by commit SHA**, not by tag.
- `concurrency` cancels outdated runs on the same branch.
- Bun and its install cache are set up with `oven-sh/setup-bun` and `actions/cache`.
- CI never needs network access *from the app*: an e2e test asserts that the running app makes **zero outbound requests** (intercept all requests in test mode and fail on any non-local URL).
- CI runners have no audio device: unit tests of `engine/` use a mocked or offline AudioContext; e2e tests launch Electron with the flags needed for audio without user gesture and do not assert on audible output. If this turns out to be impossible, document it in `docs/DECISIONS.md`.
- Code signing and notarization (macOS, Windows) are **optional**: `release.yml` signs only when the corresponding secrets exist, and still produces unsigned installers otherwise.
- Secrets never appear in logs; no secret is available to workflows triggered by pull requests from forks.

## Electron security

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` for every window
- The preload exposes a **minimal** API through `contextBridge`; every IPC channel validates its arguments in the main process
- Strict Content Security Policy, no remote content
- The sample protocol (`motif-sample://`) resolves paths only inside allowed folders (path traversal protection)
- Strudel code is executed JavaScript: a project received from someone else is untrusted code. Show a warning when opening an external project that contains free code, and expose nothing in the preload that malicious code should not be able to call
- Explicitly allow the `midi` permission with `session.setPermissionRequestHandler`, deny everything else by default

## Way of working

- **One phase at a time**, in the order of `docs/PHASES.md`. Do not anticipate later phases beyond what is needed.
- At the start of a phase: re-read its section, propose a short plan, wait for approval, then implement.
- At the end of a phase: all acceptance criteria checked, `typecheck`, `lint` and `test` green, then a summary of what was done and what remains uncertain.
- Small, atomic commits, imperative mood (e.g. `Add step sequencer grid`).
- When a Strudel API behaves differently from the spec, **do not work around it silently**: log it in `docs/DECISIONS.md` (date, problem, decision) and adapt.
- Tasks marked **[SPIKE]** are investigations: build a minimal prototype and write a note in `docs/DECISIONS.md` before implementing the full feature.

## Conventions

- Components in PascalCase, one component per file, hooks prefixed with `use`.
- UI copy: short sentences, sentence case, no em dashes or en dashes (plain hyphen `-` only), no emoji.
- Every Strudel function shown in the UI displays its matching code next to its label (the app teaches Strudel as it is used).
