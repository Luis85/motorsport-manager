# Motorsport Manager documentation

Choose the documentation for what you need to do. [Current project status](reference/current-state.md)
distinguishes the shipped Minimal weekend and four-event campaign from optional
Advanced interfaces, diagnostic tools and foundations awaiting specialist UI.

| Need | Start here |
|---|---|
| Learn to play a first weekend or campaign event | [Tutorials](tutorials/README.md) |
| Edit a circuit, author content, tune values or verify a checkout | [How-to guides](how-to/README.md) |
| Look up UI, campaign, content, storage or tooling contracts | [Reference](reference/README.md) |
| Understand simulation, architecture and ownership choices | [Explanation](explanation/README.md) |
| Inspect earlier implementation and source-bound acceptance | [Historical archive](_archive/README.md) |

## Common routes

- **New player:** [First weekend](tutorials/getting-started.md) →
  [First campaign event](tutorials/first-campaign.md).
- **Circuit author:** [Edit a copied circuit](how-to/first-circuit.md) →
  [Editor guide](how-to/track-editor.md) → [Track format](reference/track-format.md).
- **Content author:** [First custom pack](tutorials/author-a-pack.md) →
  [Content index](reference/content/README.md) → [Balancing](how-to/balancing.md).
- **RTS mission author:** [Explore the RTS demo](tutorials/rts-demo.md) →
  [Author a mission](how-to/rts-mission-editor.md) → [RTS contract](reference/rts-engine.md).
- **Developer:** [Architecture](explanation/architecture.md) →
  [Mechanics recipes](how-to/developing-mechanics.md) or
  [Toolbox experiments](how-to/toolbox-recipes.md) → [Verification](how-to/verification.md).
- **Maintainer:** [Documentation discipline](how-to/maintaining-documentation.md) →
  [Current status](reference/current-state.md) → [Advisory quality](how-to/code-quality.md).

## Standalone CLI projects

Two independent Node/TypeScript projects live under `source/`, outside the Godot
game. Each builds a self-contained command-line bundle that is checked in under
[`bin/`](../bin/README.md) and needs only Node.js 22 or newer, without `npm ci`.

| Project | Checked-in CLI | Handbook |
|---|---|---|
| [Wildlands](../source/wildlands/DOCUMENTATION.md) | `bin/wildlands` | [Wildlands CLI](reference/wildlands-cli.md) |
| [Scene Forge](../source/scene-forge/README.md) | `bin/scene-forge` | [Scene Forge CLI](reference/scene-forge-cli.md) |

The separate Wildlands documentation indexes the TypeScript prototype builder,
its default Littlewild showcase, browser/terminal workflows and Node-backed Godot
desktop target. Scene Forge is a standalone CLI and offline 3D editor for
declarative modeling, reusable scene composition, portable rigs and multi-view
review. Each project retains its own runtime, tests and source-bound evidence
outside the native Motorsport Manager capability inventory.

## Authority and evidence

Production code, generated schemas and validated configuration own executable
contracts. Active references describe those contracts; tutorials and recipes link
them rather than introducing another authority. Application release, save/model
and content versions are distinct; see [persistence](reference/persistence.md).

Historical records retain original source IDs, measurements and limitations.
A later commit needs its own verification evidence. The complete suite registry
is `scripts/verification_suites.json`; historical assertion counts and completed
advisory jobs do not certify gameplay, human usability or hardware performance.

The organization follows [Diátaxis](https://diataxis.fr/), with archived project
records separate from its four reader-focused forms. Keep this directory limited
to README/index files; place documents in the corresponding section and run
`python3 scripts/check_docs.py` after edits or moves.
