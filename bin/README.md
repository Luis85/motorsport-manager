# Checked-in command-line tools

This directory holds self-contained Node.js command-line tools built from the
independent TypeScript projects under [`source/`](../source/). They are separate
from the native Motorsport Manager Godot game: they do not read or write its
saves, configuration or race/campaign state. Read the handbook before scripting
a tool; each documents its JSON protocol, exit codes and limits.

| Command | Purpose | Handbook | Source project | Rebuild | Check |
|---|---|---|---|---|---|
| `bin/wildlands` | Create, validate, inspect, play, edit and compile portable Wildlands game projects into Godot desktop projects | [Wildlands CLI](../docs/reference/wildlands-cli.md) | [`source/wildlands/`](../source/wildlands/README.md) | `cd source/wildlands && npm ci && npm run build:cli` | `cd source/wildlands && npm run check:cli` |
| `bin/scene-forge` | Author, validate, export and review declarative 3D projects, models and scenes | [Scene Forge CLI](../docs/reference/scene-forge-cli.md) | [`source/scene-forge/`](../source/scene-forge/README.md) | `cd source/scene-forge && npm ci && npm run build:cli` | `cd source/scene-forge && npm run check:cli` |

## Requirements

- Node.js 22 or newer on `PATH`. Nothing else is needed for most commands: no
  `npm ci`, `node_modules`, build step or network access.
- `bin/scene-forge screenshot` and `review` additionally need Playwright and a
  Chromium build; `bin/scene-forge doctor` reports their status.
- Projects written by `bin/wildlands compile` or `export` need Godot to run.
- Where the executable bit or `#!/usr/bin/env node` line is not honored (for
  example on Windows), run `node bin/<tool> …`.

## Quick examples

Run from the repository root:

```sh
bin/wildlands --help
bin/scene-forge --help
node bin/wildlands discover
```

`bin/wildlands` always prints one JSON object. `bin/scene-forge` prints JSON for
its commands; add `--compact` for smaller responses.

## Generated files: never edit by hand

Both executables are generated bundles. Do not edit, format or patch them
directly. After any change under `source/wildlands/` or `source/scene-forge/`,
rebuild the matching executable with its rebuild command and commit it together
with the source change. Each project's `npm run check:cli` rebuilds the bundle
without replacing it and fails when the checked-in file differs or is not
executable; CI runs it.
In `source/wildlands/`, plain `npm run build` does not refresh `bin/wildlands`.
