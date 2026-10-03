# Littlewild 3D asset architecture

## Purpose

All gameplay-facing 3D models are separated from renderer behavior and stored as immutable, declarative data. The renderer interprets a small primitive scene format; model authors edit asset manifests rather than adding `kind === ...` branches to `world-3d.ts`.

## Folder contract

```text
source/assets/
├── asset.schema.json
├── README.md
├── buildings/
│   └── <building-id>/asset.json
├── items/
│   └── <item-or-prop-id>/asset.json
└── creatures/
    ├── catalog.json
    ├── catalog.schema.json
    ├── creature.schema.json
    └── <creature-id>/
        ├── creature.json
        └── asset.json
```

Creature gameplay and visual manifests share one assets folder; gameplay uses `visualAsset` to select a bundled actor asset independently of the archetype ID. `creatures/catalog.json` selects the default archetype. The visual runtime category remains `actor`.

The folder name is the stable model ID. The manifest must repeat that identity and category. The build rejects missing manifests or a path/identity mismatch.

Current catalog: **67 assets** — 24 buildings, 42 items/environment/equipment models and 1 actor.

## Manifest

Each manifest has:

- `format: "littlewild-3d-asset"`, `schemaVersion: 1`;
- `category`, stable `id`, display `name`;
- named `materials` with color/material properties;
- one or more `models`, each containing a primitive-node tree;
- `metadata` such as hit height, radius and orientation;
- optional data-only `behaviors` for known presentation anchors;
- actor-only `rig` references for the compiled animation program.

Supported model variants are intentionally conventional rather than executable: buildings use `world`; items can provide `world`, `depleted`, `carry`, and `equipped`; actors currently use `world`.

Primitive nodes support groups, boxes, low-poly balls, soft/tiny spheres, cones, cylinders, rings, roofs and ground planes. Nodes can carry position, rotation, scale, material role, visibility and stable IDs. There is no callback, script, module, shader source or arbitrary class field.

## Engine boundary

`asset-catalog.ts` validates every bundled definition, verifies known behavior/rig references and deeply freezes the result. `asset-renderer.ts` is the generic Three.js scene interpreter. It creates meshes from data and returns named handles to presentation code.

`world-3d.ts` owns the camera, scene, terrain surface, batching, transient selection/path/build-plan helpers, world placement and animation scheduling. It no longer owns building/resource/actor/equipment model construction.

`world-fidelity.ts` owns **behavior**, not geometry: gait, breathing, blinking, facial pose, carried-item choice, care gestures and attaching equipment to data-authored sockets. The Sproutling body and sockets are defined in `creatures/sproutling/asset.json`.

The software renderer consumes the same Three.js scene. There is no separate low-fidelity model catalog.

## Building contract

A building manifest includes everything the visual engine needs to instantiate its static model. Known optional behaviors are data anchors:

- `door.node` + `openDelta`;
- `rotors[]` with node, axis and speed;
- `smoke.position` + `always`.

Navigation, work capacity, recipes, construction cost and gameplay eligibility remain domain/content definitions, not visual-asset data. Indoor/outdoor semantics remain authoritative in gameplay code. The visual asset must match those semantics but cannot change them.

## Item contract

Gameplay resources and equipment reuse one asset family.

A resource can provide a world/depleted model and a carry model. The companion renderer chooses an actual carried item from inventory/task context and attaches the asset to the actor's carry socket.

Equipment definitions continue to choose stable item IDs and author gameplay-facing `slot`, `visual`, and `color` data. The asset catalog supplies the concrete mesh. The runtime can override named material roles (currently primarily `primary`) with the authored equipment color without cloning renderer code.

Environment props such as reeds, wildflowers, lilies and shoreline rocks also live here because they are reusable world objects rather than renderer helpers.

## Actor contract

Actors own geometry and named rig nodes. The current `sproutling` asset declares body/head/limb/expression handles and sockets for headwear, body wear, back equipment, feet, tools, charms and carried goods.

The animation program is intentionally compiled. Asset data says **what exists and where it attaches**; code says **how state animates it**. This keeps manifests data-only while allowing new geometry and visual refinement without rewriting animation logic.

## Authoring workflow

1. Copy the closest asset folder inside the correct category.
2. Give the folder and manifest a new stable ID.
3. Edit materials and primitive nodes; keep behavior/rig references valid.
4. Connect the new ID to an existing supported gameplay definition when appropriate.
5. Run:
   ```sh
   npm run typecheck
   npm run architecture
   npm run verify
   ```
6. The asset suite must confirm path identity, gameplay coverage, data-only shape, references and immutability. Browser suites then exercise the rebuilt self-contained application.

A new visual variation should normally be an asset/model/material edit. A renderer change is justified only when a genuinely new rendering capability is needed.

## Import and trust boundary

The catalog is bundled at build time. Scenario packs and portable stories do **not** carry asset manifests and cannot register renderer behaviors or executable loaders. This preserves PR25's existing data-only import boundary.

Supporting third-party asset packs later requires an explicit versioning, size/performance, compatibility and trust policy. It should not be implemented by relaxing scenario JSON validation.
