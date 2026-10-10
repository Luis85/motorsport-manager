# Author Armored Platoon content

Use the [game folder](../concepts/armored-platoon/README.md) as the data source and
the Model Forge and Scene Forge source projects as the editable asset source.
The assets were authored independently under the repository MIT license;
[provenance](../concepts/armored-platoon/PROVENANCE.md) explains their limits.

## Edit a tank safely

Read the [Model Forge handbook](../reference/model-forge-cli.md). Discover its
schemas, inspect the explicit `.model.json` under
`source/model-forge/examples/armored-platoon/`, and retain `revision` and
`stateHash`. Write a complete batch, dry-run with both guards, then apply the same
batch with the same guards. Inspect again on any conflict. The original batches,
portable bundles, revision-zero history and `workflow.json` receipts remain beside
each document. `scripts/armored-platoon-author.mjs` in Model Forge documents and
reproduces the initial creation workflow in fresh destinations; use `--models <new-dir>
--project <new-dir>` to replay without replacing source. It refuses existing
projects and never overwrites source documents.

Validate and audit, then visually review:

```sh
bin/model-forge -d source/model-forge/examples/armored-platoon/m4-sherman.model.json validate
FORGE_CHROMIUM_PATH=/usr/bin/chromium bin/model-forge -d source/model-forge/examples/armored-platoon/m4-sherman.model.json review --out /tmp/sherman-review-new
```

Export a new `model-bundle`; inspect the Scene Forge project, dry-run its
`model import --replace` with both guards, and repeat with the same guards to
commit. Never write a registered Scene Forge model in place. Then use
`scene-forge -p source/scene-forge/examples/armored-platoon export --format three
--model m4-sherman --out source/scene-forge/examples/armored-platoon/exports/m4-sherman.three.json`.
Repeat for the other changed model. The Three output is generated and must never
be patched by hand.

From `source/model-forge`, run:

```sh
node --import tsx scripts/armored-platoon-export.ts
node --import tsx --test tests/semantic-bindings.test.ts
```

The export adapter reads actual Scene Forge outputs and imported model recipes,
then invokes the public kernel `semanticBindings` helper. Required articulation
and attachment roles fail closed if absent or repeated. The pack uses metres,
+Y up, +Z forward and column-major matrices. Forge Euler inputs are degrees;
runtime angles are radians. The turret is parented to the hull; gun elevation to
the turret; recoil translation to the gun. Runtime yaw is converted to local yaw
at the presentation boundary. Bind by the recorded `path`, never an incidental
array index or Three UUID.

Tag groups `articulation:turret`, `articulation:gun`, `articulation:recoil`, and
`socket:muzzle`/`socket:optic`/`socket:commander`/`socket:exhaust`. Hidden geometry
with `volume:engine` or `volume:ammunition` exports a semantic world-space rest
AABB. Three's visible runtime export omits hidden volume meshes; the helper reads
the full imported recipe and retains their matrices/bounds separately. These
volumes are descriptive source data; runtime component damage currently uses its
own documented approximation rather than consuming these AABBs.

## Edit a mission

Change `content/catalog.json` against the versioned armored catalog contract.
Terrain is a row-major Z/X array; width and depth count samples, and `cellSize`
is metres. Spawn coordinates are world metres; yaw is radians. Stable obstacle IDs
and explicit collider centres are shared with Scene Forge placement batches.
`crossroads.batch.json` preserves the initial layout and `terrain.batch.json`
replaces its initial base plane with the exact source terrain vertex samples.
Both were dry-run and committed with revision and state guards; their `.workflow`
records preserve the result. The scene is an authoring preview, not a second
simulation authority. Pine Ridge replaces the settlement with a denser forest, adds different relief
and uses survive/reach objectives. Iron Counterattack reverses faction policy
on the village layout. These are development scenarios rather than a reproduced
campaign.

Validate the whole folder and rebuild the engine artifact through the normal
Wildlands build. Any kernel change must rebuild and check both Forge executables.
Generated `bin/` and `demos/` files are never edited directly.

## Current fidelity boundary

These are low-poly original studies: roughly 4,000 triangles and 170–185 visible
meshes per tank. They have road wheels, track shoes, distinct turret profiles,
side skirts/bogies, cupolas, hatches, optics, engine vents, antennae and gun parts.
They do not provide photogrammetry, production texture maps, LODs, tank interiors,
crew animation, continuous deforming tracks or reference-quality vehicle models.
Character Studio's creature/outfit pipeline does not provide WWII crew and was
read but not used to manufacture a false crew-animation claim. Full materials,
crew tooling, mission compilation and measured reference parity remain work.

The reusable scene bridge is
`node source/scene-forge/scripts/armored-platoon-scene.mjs --catalog <catalog.json>
--mission <id> --project <scene-project> --scene <scene-id> --batch-out <new-batch.json>`.
It writes an ordinary batch and dry-run diagnostics; add `--apply` to commit that
exact batch with inspected guards. It checks finite bounded terrain, world extents,
duplicate identities, absent vehicles, spawns intersecting obstacles and elimination
targets with no spawn. It flags objective-access review instead of asserting that a
collider layout proves navigation. Switching missions requires a fresh scene: it
upserts specified nodes and preserves unrelated authored nodes.

## Normalize generated JSON without changing authored state

The artifact pipeline ends with Prettier **3.6.2**, pinned by the existing lockfile.
`format-authored-json.mjs` normalizes example recipes, portable exports and workflow
receipts, including retained JSON history records. It verifies exact parsed-value
equality before each write: only whitespace changes, so revisions and canonical
state hashes remain valid. History JSON remains the same historical state, though
its formatting is normalized rather than retaining the original serialization.
No generated geometry or policy values are hand-patched. The authoring script runs
this stage automatically, and `--normalize-only` reruns just this final stage for
already-created outputs. The scene compiler and runtime packager also run it.

Fresh replay with `--models <new-dir> --project <new-dir>` produces byte-identical
normalized Three exports. Before packaging, the exporter independently recompiles
the imported Scene Forge model and compares the complete visible export as JSON
with the supplied Three file. A stale geometry, material, hierarchy or transform
export fails before replacing `content/visuals.json`; re-export through Scene Forge
and retry. `--project <project-dir> --output <new-pack.json>` supports an isolated
verification copy. The normalization is part of the documented build, not an
exception to the existing formatting gate.
