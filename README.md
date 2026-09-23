# Motif

Powered by Strudel.

Motif is a desktop music production app built on [Strudel](https://strudel.cc), the JavaScript port of TidalCycles. You compose with a step sequencer, a piano roll, a mixer, modulation and an arrangement view, and every action writes Strudel code that stays visible and editable. Beginners can do everything with the mouse, advanced users can do everything in code.

Motif runs fully offline: samples and fonts are bundled, and the app makes no network request.

Motif is in early development. See [docs/PHASES.md](docs/PHASES.md) for the roadmap.

## Development

Requires [Bun](https://bun.sh).

```
bun install          # dependencies
bun run dev          # run the app in development mode
bun run test         # unit tests (Vitest; do not use `bun test`)
bun run lint         # ESLint
bun run typecheck    # TypeScript
bun run package      # installer for the current OS, in dist/
```

The functional specification, design system and technical decisions live in [docs/](docs/).

## License & credits

Motif is free software, licensed under the GNU Affero General Public License, version 3 or later ([LICENSE](LICENSE)), the same license as Strudel.

Motif would not exist without:

- [Strudel](https://strudel.cc) ([source](https://codeberg.org/uzu/strudel)), by the Strudel contributors, which provides the pattern language, the scheduler and the audio engine (superdough).
- [TidalCycles](https://tidalcycles.org), by the TidalCycles contributors, whose ideas and mini-notation Strudel brings to JavaScript.

Motif bundles the Geist and Geist Mono fonts, licensed under the SIL Open Font License 1.1. The licenses of all bundled dependencies are listed in `THIRD_PARTY_LICENSES`, generated with `bun run licenses` and shipped with every installer. Bundled samples and their licenses are listed in [resources/samples/LICENSES.md](resources/samples/LICENSES.md).

The Motif name and logo are not covered by the AGPL. They identify this project and may not be used to present a modified version as the original Motif. You may of course redistribute and modify the code under the terms of the AGPL, under another name.
