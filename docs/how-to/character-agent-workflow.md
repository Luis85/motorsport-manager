# Manage a character through all three agent tools

Use Character Studio for the character recipe, Scene Forge for advanced visual
authoring, and Wildlands for the validated game project. Each command is
noninteractive. Inspect the actual JSON contract before authoring; do not infer
flags or edit project internals. Node.js 22+ runs the three checked-in executables.

## Discover and create

Run from the repository root with a new working directory:

```sh
mkdir -p work/character-workflow
bin/character-studio discover
bin/character-studio schema --kind batch
bin/scene-forge catalog
bin/scene-forge describe model import
bin/wildlands creature discover
bin/character-studio create --project work/character-workflow/characters --id moss --name Moss --preset fern
bin/character-studio inspect --project work/character-workflow/characters --id moss
```

Save `revision` and `stateHash` from the inspection. Write an operation batch such
as this to `work/character-workflow/coat.batch.json`:

```json
{"operations":[
  {"op":"set","path":"/appearance/coat","value":"#a4ba99"},
  {"op":"set","path":"/outfits/back","value":"field_satchel"}
]}
```

Call `character-studio apply` with `--project`, `--id moss`, `--file`,
`--expected-revision` and `--expected-state`, first with `--dry-run`, then without
it. Use the same guards for both. A conflict means inspect again and reconsider
the change. `history`, guarded `undo` and guarded `redo` support maintenance.

## Review the real visual

Run `character-studio doctor --project DIR --capture` before rendering and inspect
`capture.ready`. If Playwright/Chromium are
unavailable, follow its remedies; do not report visual acceptance from JSON
validation alone. `capture` and `review` render the actual compiled asset.
Discover the current view and review options instead of guessing them.

```sh
bin/character-studio preview --project work/character-workflow/characters --id moss --out work/character-workflow/moss.html
bin/character-studio capture --project work/character-workflow/characters --id moss --camera front --light studio --out work/character-workflow/moss-front.png
bin/character-studio review --project work/character-workflow/characters --id moss --out work/character-workflow/review-v1
bin/character-studio export --project work/character-workflow/characters --id moss --format recipe --out work/character-workflow/moss.recipe.json
bin/character-studio export --project work/character-workflow/characters --id moss --format package --out work/character-workflow/moss.package.json
```

Inspect the render against the artboard: silhouette, proportions, eyes, coat,
material response and outfit placement. Keep the recipe as the source of Studio
edits, and keep captured view settings when comparing versions. New filenames
preserve earlier output evidence.

After an edit, repeat `review` with `--plan
work/character-workflow/review-v1/replay-plan.json` and a new `--out` directory.
The manifest binds each frame to the recipe, compiled visual, camera and lighting.

## Install into a portable engine project

```sh
bin/wildlands create --game docs/concepts/littlewild --output work/character-workflow/base.project.json
bin/wildlands creature list --project work/character-workflow/base.project.json
```

Take `fingerprint` from the list response. Call `creature import` with
`--project work/character-workflow/base.project.json`,
`--file work/character-workflow/moss.package.json`,
`--expected-fingerprint HEX` and `--dry-run`. Then repeat with
`--output work/character-workflow/moss-v1.project.json` instead of `--dry-run`.
Validate and inspect:

```sh
bin/wildlands validate --project work/character-workflow/moss-v1.project.json
bin/wildlands creature inspect --project work/character-workflow/moss-v1.project.json --archetype moss
```

This installs an archetype, not a new live companion. Existing companion state
and simulation time remain unchanged. Use a discovered `--scene`/`--instance`
selection and native creature recipe when deliberately editing a companion.

## Refine in Scene Forge and return to the engine

```sh
bin/scene-forge init work/character-workflow/models
bin/scene-forge -p work/character-workflow/models inspect
bin/scene-forge -p work/character-workflow/models littlewild import --definition work/character-workflow/moss.package.json --expected-revision R --expected-state HASH --dry-run
bin/scene-forge -p work/character-workflow/models littlewild import --definition work/character-workflow/moss.package.json --expected-revision R --expected-state HASH
```

Replace `R` and `HASH` with the fresh inspection values. Use the returned variant model IDs. `model export ID --out NEW.json` creates an
editable dependency bundle. Adjust its declared material or geometry fields,
then `model import --file FILE --replace` with the latest scene revision and
state hash, first dry-run and then commit. Model changes can change `stateHash`
without incrementing scene revision; always pass both guards. Save exported
bundles as model history, since scene history does not version model definitions.

Use `schema --kind material --raw` to discover physical material fields, including
sheen and clearcoat. Use `review --model ID --out NEW_DIRECTORY` and inspect the
contact sheet; replay its `replay-plan.json` to compare the same cameras after
refinement. `export --model ID --validate --out NEW.glb` checks the portable mesh.

Export the Studio **definition** into a scratch path ending in
`creatures/moss/definition.json` first. Then call Scene Forge `littlewild export`
with `--model ID --family creatures --variant VARIANT --out` pointing to that
complete definition. First use `--dry-run`; after reviewing the report, repeat
without it. This retains the other variants, gameplay, behavior mappings and rig
metadata. A newly generated incomplete actor definition may not be suitable for
an existing character.

Inspect `moss-v1.project.json` again, then call Wildlands `creature attach-visual`
with its `--project`, `--archetype moss`, the refined definition as `--file`, and
the latest `--expected-fingerprint`. Dry-run, then publish to
`--output work/character-workflow/moss-v2.project.json`. Validate the result and
use `creature export` to archive the maintained package. This handoff changes
appearance while retaining gameplay and companion state.

## Maintain and recover

Keep Studio recipes, exported model bundles, engine project versions and review
evidence together. Advanced Scene Forge edits cannot be losslessly represented by
a Studio recipe; Studio explicitly rejects their re-import. Continue such edits
in Scene Forge, or deliberately restart from a retained Studio recipe.

Engine import needs `--replace` to change existing archetypes or referenced
assets. Inspect its replacement report before committing. Creature commands
publish only to a new destination, so recovery is selecting an earlier project
file. No command in this workflow needs to overwrite a game folder or save.

To verify the complete non-rendering lifecycle against the actual executables:

```sh
cd source/character-studio
npm run test:handoff
```

This bounded gate covers guarded changes, Studio undo/redo, engine package
installation, Scene Forge refinement, rig/gameplay preservation, validated GLB
exports and engine re-export. Browser visual review remains a separate required
step when judging fidelity. Reference: [Character Studio](../reference/character-studio-cli.md),
[Scene Forge](../reference/scene-forge-cli.md), [Wildlands](../reference/wildlands-cli.md).
