# Technical decisions

Log of choices and findings made during development.
Format: date - problem - decision.

## 2026-09-23 - Toolchain versions

- **Problem**: the latest releases do not fit together. electron-vite 5.0.0 accepts vite 5 to 7 only (vite 8 is current), `@vitejs/plugin-react` 6 requires vite 8, and typescript-eslint accepts TypeScript below 6.1 (TypeScript 7 is current).
- **Decision**: pin vite 7.3, `@vitejs/plugin-react` 5.2 and TypeScript 6.0. Revisit when electron-vite 6 and a typescript-eslint release supporting TypeScript 7 are stable. TypeScript 6 deprecates `baseUrl`, so path aliases are declared relative to each tsconfig.

## 2026-09-23 - Electron binary download

- **Problem**: Electron 44 no longer ships a `postinstall` script. `bun install` leaves `node_modules/electron` without its binary.
- **Decision**: nothing to configure. The binary is downloaded on first use (`electron` CLI, electron-vite, electron-builder). CI runs `bun run build` before anything that needs the binary. Note for agents running inside VS Code: `ELECTRON_RUN_AS_NODE=1` is inherited from the editor and makes Electron start as plain Node; unset it before `bun run dev`.
