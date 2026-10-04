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
- **Developer:** [Architecture](explanation/architecture.md) →
  [Mechanics recipes](how-to/developing-mechanics.md) or
  [Toolbox experiments](how-to/toolbox-recipes.md) → [Verification](how-to/verification.md).
- **Maintainer:** [Documentation discipline](how-to/maintaining-documentation.md) →
  [Current status](reference/current-state.md) → [Advisory quality](how-to/code-quality.md).

## Authority and evidence

The separate [Wildlands documentation](concepts/littlewild/DOCUMENTATION.md)
indexes the TypeScript prototype builder, its default Littlewild showcase,
browser/terminal workflows and Node-backed Godot desktop target. It retains its
own runtime and source-bound evidence outside the native Motorsport Manager
capability inventory.

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
