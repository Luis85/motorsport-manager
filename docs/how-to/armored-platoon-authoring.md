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
portable bundles, retained revision history and `workflow.json` receipts remain beside
each document. `scripts/armored-platoon-author.mjs` in Model Forge documents and
reproduces the initial creation workflow in fresh destinations; use `--models <new-dir>
--project <new-dir>` to replay without replacing source. It refuses existing
projects and never overwrites source documents.

The fresh-creation script includes the shared original fitting/finish recipe in
`scripts/armored-platoon-details.mjs`. To apply that recipe to existing source
documents, use `node source/model-forge/scripts/armored-platoon-refine.mjs` from
the repository root. It inspects, dry-runs and applies with revision/state guards,
validates and audits each model, exports its bundle, then performs a guarded Scene
Forge replacement and native Three export. Its `--models` and `--project` options
support isolated copies. It does not patch imported models or generated geometry.
The `.refine.batch.json` files and `refinement.workflow.json` retain that intent
and execution evidence; revision 3 is the current visually reviewed recipe.

Validate and audit, then visually review:

```sh
bin/model-forge -d source/model-forge/examples/armored-platoon/m4-sherman.model.json validate
bin/model-forge -d source/model-forge/examples/armored-platoon/m4-sherman.model.json audit --file source/model-forge/examples/armored-platoon/quality-policy.json --strict
FORGE_CHROMIUM_PATH=/usr/bin/chromium bin/model-forge -d source/model-forge/examples/armored-platoon/m4-sherman.model.json review --out /tmp/sherman-review-new
```

Export a new `model-bundle`; inspect the Scene Forge project, dry-run its
`model import --replace` with both guards, and repeat with the same guards to
commit. Never write a registered Scene Forge model in place. Then use
`scene-forge -p source/scene-forge/examples/armored-platoon export --format three
--model m4-sherman --out source/scene-forge/examples/armored-platoon/exports/m4-sherman.three.json`.
Repeat for the other changed model. The Three output is generated and must never
be patched by hand.

The native quality policy caps each visible model at 12,000 triangles, 256 meshes,
12 materials, 64 geometries and 8 metres maximum extent. It requires UVs and
rejects transparent or double-sided materials. These are authoring limits, not
measured frame-time or reference-fidelity acceptance.

## Author native vehicle finishes

Material `finish` records use version 1, `kind` (`painted-metal`, `bare-metal` or
`rubber`), integer `seed` from 0–65,535, `scale` from 1–16 and `wear` from 0–1.
An optional palette has one to four six-digit hex colors. Palette colors multiply
the material's base color; use `#ffffff` for literal palette colors. Roughness and
metalness remain authored multipliers. Painted-metal intact regions have zero
map metalness, with exposed areas responding to the authored metallic value.
The finish cannot be combined with the separate organic `surface` recipe.

Model Forge generates deterministic 128 × 128 RGBA color, tangent-normal and
packed roughness/metalness maps through `forge-finish-v1`. Color is sRGB;
normal/roughness/metalness data is linear. The two current tanks each use four
unique finish recipes: paint, track metal, fitting metal and rubber. Armor and
raised armor share the paint textures while retaining separate base tints.
Final paint scale 1 and wear 0.055 replace the visually overbusy initial revision;
its state remains in history. These are original procedural finishes, with no
external image sources or sampled reference paint schemes.

## Package the runtime visuals

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

The visual envelope is version 2, independently of the physics solver and catalog
versions. Admission retains scalar v1 packs and adds only bounded inline RGBA8
maps for v2; it does not accept arbitrary URLs, image decoders, skins or animation.
After checking equality with the native Three export, the compiler encodes each
image's unchanged RGBA8 bytes as canonical base64. The typed image record retains
`width:128`, `height:128`, `type:"Uint8Array"`, adds `encoding:"base64"` and stores
the 87,384-character payload in `data`. Admission also retains the numeric-array
variant without `encoding`. It checks decoded image budgets before realization;
this encoding does not authorize URLs or arbitrary image decoders.

The compiler writes compact JSON to preserve the existing 8 MiB per-file and
standalone play-artifact budgets. Do not pretty-print that shipping file or raise
limits to admit a larger export. The compiled pack contains 3,133,629 bytes and
96,685 values under the 3,000,000 aggregate limit, with the same 1,572,864 decoded
image bytes under the 2 MiB image limit. Each asset has 12 images and 12 textures.
Decoding the final pack reproduced both native Three exports exactly, including
every pixel, while all semantic bindings stayed unchanged. The preceding numeric
pack passed the folder bound but made the complete HTML exceed its existing
budget; compact transport addresses that overhead without reducing quality.
A changed pack requires new validation and runtime verification.
The final base64 pack passed the actual source visual admission and closed
game-folder inventory checks; these do not substitute for integrated browser tests.

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
is metres. Spawn coordinates are world metres; yaw is radians. Stable obstacle IDs are shared with Scene Forge placement batches. Runtime obstacle
`position.y` is its base, grounded by the runtime bilinear height sampler at its
X/Z location. Forge box primitives are centered, so the scene compiler writes
`position.y + size.y / 2` to the authored mesh transform.
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

## Author finite supply depots

Catalog version 1 accepts optional `mission.supplies` with at most 64 entries.
Each entry has exactly `id`, `name`, `faction`, `position`, `radius`,
`ammunition`, `repairKits` and `transferSeconds`. IDs are unique within the
mission; position uses world metres inside the map. Radius is 1–100 metres,
transfer duration 0.1–300 seconds, ammunition keys must exist in the catalog,
and stock counts are integers: 0–100,000 per ammunition type and 0–10,000 kits.
Unknown fields, invalid references and nonfinite values are rejected. A mission
without `supplies` remains valid. Catalogs declaring `supplies` reserve runtime
entity IDs beginning `depot:`; legacy catalogs without that field retain their
previous spawn-ID rules.

For example, the current scenarios each place one friendly depot at X=264,
Z=128, with 12 m radius, 36 AP / 18 HE / 12 smoke rounds, six kits and an
eight-second transfer duration. Use actual catalog ammunition IDs as map keys.
Stock is finite per mission instance; it is not a spawn-time vehicle loadout or
an inexhaustible refill. At service completion, selected ammunition has priority,
then the vehicle's authored ammunition order, up to its shared ammo capacity;
kits fill only to its authored kit capacity. Multiple vehicles compete for the
same remaining stock deterministically. Cancelled service consumes no stock.

Depots are gameplay data, not geometry or a second authority in Scene Forge.
Validate and rebuild the closed game folder after editing. Review friendly
access, radius, intended scarcity and reachable service positions through play;
a syntactically valid position does not establish a safe navigable depot.
Fresh v2 sessions instantiate these stocks and checkpoint their remaining
amounts and active service transactions. Existing `tracked-force-v1` saves keep
their original semantics and do not gain depot entities or service on runtime
restore. Browser restore also requires a byte-equivalent installed catalog:
old saves predating depot/terrain changes need the matching old HTML build.
Retain that artifact when changing a pack; solver compatibility does not bypass
the browser content-match restriction.
Do not hand-edit saves to migrate them or claim earlier v1 test evidence covers
new supplies. Earlier physics-v2 implementation `bbf8475e` passed 68/68 Armored Node checks (including 13
logistics checks) within the 902/902-check fast tier. The final rebuilt artifact
passed 12/12 browser checks, CLI current-output and all seven demo freshness
checks. Earlier intermediate results retain separate artifact identities.
Public-command routes reached all three depots: Pine/Iron each
received one ammunition round; fire cancelled Crossroads service without stock consumption.
All ten CI workflows passed on the identical implementation/CI merge tree.
Native passed 103 suites / 21,346 checks across six shards and aggregation;
Wildlands passed 2,192/2,192 checks across 123 suites in 2,076.55 seconds,
with separate guarded Storytelling 24 and Godot export 21 checks passed. A bounded `bbf8475e`
30-minute software observation completed seven exact checkpoint restores and
seven mission switches with 338/338 scripted workload commands, no errors or
warnings. This does not establish full Q03, performance or leak freedom. These
results establish the registered implementation checks, not full reference
parity or production-hardware acceptance. The
[11 October evidence archive](../_archive/armored-platoon-2026-10-11-evidence/README.md)
records final artifact identities and preserves earlier results separately.
These historical complete-gate results do not verify the later material/geometry
refinement or its regenerated browser artifact.

## Current fidelity boundary

These remain stylized original studies. Revision 3 has 7,508 triangles and 213
visible meshes for the Sherman, and 6,572 triangles and 224 visible meshes for
the Panzer. Alongside the road wheels, track shoes, turret profiles, side skirts/
bogies, cupolas, optics, vents, antennae and gun parts, they now include driver
hatches, handles, tow/lifting rings, weld seams, lamp guards, fender braces, tool
clamps and exhausts. The Sherman has a smoother turret and rounded transmission
cover. Both native audits passed with zero warnings or errors. All 24 Sherman
and 28 Panzer articulation/socket/volume nodes remained unchanged.

Fixed-camera Model Forge reviews compared the earlier model, initial finish and
final revision; these are software-rendered asset reviews, not gameplay-motion
or AAA acceptance. The models do not provide photogrammetry, bespoke UV-atlas
painting, LODs, tank interiors, crew animation, continuous deforming tracks or
reference-quality vehicle models. Primitive UV seams and inconsistent texture
density remain visible limits.
Character Studio's creature/outfit pipeline does not provide WWII crew and was
read but not used to manufacture a false crew-animation claim. Production materials,
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

The recipe/export normalization uses Prettier **3.6.2**, pinned by the existing lockfile.
`format-authored-json.mjs` normalizes example recipes, portable exports and workflow
receipts, including retained JSON history records. It verifies exact parsed-value
equality before each write: only whitespace changes, so revisions and canonical
state hashes remain valid. History JSON remains the same historical state, though
its formatting is normalized rather than retaining the original serialization.
No generated geometry or policy values are hand-patched. The authoring script runs
this stage automatically, and `--normalize-only` reruns just this final stage for
already-created outputs. The scene compiler and runtime packager also run it on
the authoring source and Scene Forge project; the final `content/visuals.json`
uses compact serialization as described above.

An isolated fresh revision-3 recipe replay with `--models <new-dir> --project
<new-dir>` produced byte-identical normalized Three exports for both tanks.
Parsed Model Forge source (excluding its document revision), bundle entry and
Scene Forge imported recipe also matched exactly. Before packaging, the exporter independently recompiles
the imported Scene Forge model and compares the complete visible export as JSON
with the supplied Three file. A stale geometry, material, hierarchy or transform
export fails before replacing `content/visuals.json`; re-export through Scene Forge
and retry. `--project <project-dir> --output <new-pack.json>` supports an isolated
verification copy. The normalization is part of the documented build, not an
exception to the existing formatting gate.
