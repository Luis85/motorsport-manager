# Author Littlewild assets in Scene Forge

Goal: model or edit a Littlewild/Wildlands 3D asset as a reviewable Scene Forge
recipe and publish it as a validated Littlewild definition. The
[pocket-pet project](../../source/scene-forge/examples/pocket-pet/littlewild.export.json)
is the working example; the [Pocket Pet reference](../reference/pet-engine.md)
describes how the game consumes it.

Scene Forge synchronizes every asset of a manifest at once. To refine a single
model or Littlewild visual on its own, use [Model Forge](../reference/model-forge-cli.md):
it imports one `definition.json` variant into one guarded model document and
exports it back with `export --format littlewild` to a
`<family>/<id>/definition.json` path, replacing only that variant of the
`visual` facet through the same writer as Scene Forge. Both tools follow one
lossless contract: merging into an existing definition keeps that definition's
own representation wherever a field is unchanged, so an unedited import exports
byte-identically, an edit changes only the edited fields, and Model Forge and
Scene Forge write identical bytes for the same model.

## Requirements

- Node.js 22+ and `npm ci` in both `source/scene-forge/` and
  `source/wildlands/`.
- Run `npm run build` in Scene Forge once; the commands below use `node dist/cli.js`.
  The checked-in [`bin/scene-forge`](../reference/scene-forge-cli.md) accepts the
  same `littlewild` commands from the repository root without a build.
- Chromium only for `review`/`screenshot`; set `FORGE_CHROMIUM_PATH` to an existing
  executable when Playwright's bundled browser is not installed.

## Export models into Littlewild

1. Author models as usual. Use stable IDs; Littlewild receives them in kebab case
   (`eyeL` becomes `eye-l`). Boxes and unchanged imported `lw-<primitive>`
   geometries stay native primitives. Spheres, lathes, tubes, extrusions, booleans
   and meshes are baked into bounded indexed triangles (8,192 vertices per mesh,
   40,000 per definition). Reduce `segments` if the exporter reports
   `LITTLEWILD_BUDGET`.
2. For the `pets` family, tag animated nodes with `rig:<role>`. Roles are `body`,
   `head`, `eyes`, `ears`, `tail`, `arms`, `feet`, `mouth`, `cheeks`, `sprout` and
   `shell`, plus the accessory sockets `hat`, `face`, `neck` and `back`. Paired roles
   may tag several nodes; the others must tag exactly one. Sockets are empty groups;
   their scale fits accessories authored around the origin, so one item fits every
   stage.
3. Describe the targets in a manifest (`schema --kind littlewild-export --raw`):

   ```json
   {
     "schemaVersion": 1,
     "kind": "littlewild-export",
     "target": "../../../../docs/concepts/pocket-pet/assets",
     "assets": [
       {
         "id": "pebble", "family": "pets", "name": "Pebble",
         "metadata": { "radius": 0.35 },
         "models": {
           "baby": { "model": "petBaby", "materials": { "skin": { "color": "#a9c8f5" } } }
         }
       }
     ]
   }
   ```

   `target` is relative to the manifest and names a game folder's `assets`
   directory; the pocket-pet project publishes into the
   [Pocket Pet game folder](../concepts/pocket-pet/README.md). `materials` replaces a model material for
   that variant, so one recipe can produce several species. `parameters` sets model
   parameters.
4. Preview, write and check:

   ```sh
   cd source/scene-forge
   node dist/cli.js -p examples/pocket-pet littlewild sync --file examples/pocket-pet/littlewild.export.json --dry-run
   node dist/cli.js -p examples/pocket-pet littlewild sync --file examples/pocket-pet/littlewild.export.json
   node dist/cli.js -p examples/pocket-pet littlewild sync --file examples/pocket-pet/littlewild.export.json --check
   ```

   From the repository root, the checked-in executable runs the same check with
   paths relative to the root:

   ```sh
   bin/scene-forge -p source/scene-forge/examples/pocket-pet littlewild sync --file source/scene-forge/examples/pocket-pet/littlewild.export.json --check
   ```

   Each result lists the definition path, whether it changed, per-variant
   vertices/triangles and warnings. `--check` fails with `LITTLEWILD_STALE` when a
   committed definition differs from its recipe. One model can also be exported
   with `littlewild export --model <id> --variant <name> --out
   <target>/<family>/<id>/definition.json`; `--family` defaults to the
   `<family>` directory of `--out`, and an existing definition keeps its display
   name unless `--name` replaces it.

The exporter replaces only the variants it produces. Other variants, gameplay
facets, actor behaviors and existing rigs are retained. Lights are skipped. A new
definition is written in canonical form; an existing one keeps its own
representation (key order, explicit zero transforms, empty `children`, string
material references, mesh names, unreferenced palette entries, engine-only node
fields and file layout) wherever the exported content is unchanged.

## Edit an existing Littlewild asset

```sh
node dist/cli.js -p my-project littlewild import --definition ../../docs/concepts/littlewild/assets/creatures/sproutling/definition.json
```

Each variant becomes a model such as `sproutlingWorld` (`variantModels` in the
result maps every source variant to its model ID). Engine primitives are imported
as `lw-soft`, `lw-cone` and similar geometries using the engine's exact shapes,
and pet rigs become `rig:<role>` tags. Export the edited models back into the
same definition, with `littlewild export --model <id> --variant <variant> --out
<definition>` or a manifest that names the same family, ID and variants.
Littlewild-only node fields without a Scene Forge equivalent (for example
`castShadow` and `receiveShadow`) are not part of the editable model, but export
keeps them on every node that still matches the definition. An unedited import
exports back byte-identically; an edit changes only the edited fields.

## Confirm success in Littlewild

```sh
cd ../wildlands
npm run build
npm run typecheck
node .generated/test-assets.cjs
node .generated/test-pet-catalog.cjs
```

The build validates every definition through the asset catalog, and the pet
catalog test resolves each species' stage models and props. Rebuild the demo
(`bin/wildlands build-game --game docs/concepts/pocket-pet --output pocket-pet.html`
from the repository root, or `npm run build:demos` to refresh `demos/`) and open
it to inspect the result. These checks validate data and rendering
contracts; they do not certify Blender or Godot imports.
