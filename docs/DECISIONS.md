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
