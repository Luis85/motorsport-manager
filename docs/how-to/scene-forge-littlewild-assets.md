# Author Littlewild assets in Scene Forge

Goal: model or edit a Littlewild/Wildlands 3D asset as a reviewable Scene Forge
recipe and publish it as a validated Littlewild definition. The
[pocket-pet project](../concepts/scene-forge/examples/pocket-pet/littlewild.export.json)
is the working example; the [Pocket Pet reference](../reference/pet-engine.md)
describes how the game consumes it.

## Requirements

- Node.js 22+ and `npm ci` in both `docs/concepts/scene-forge/` and
  `docs/concepts/littlewild/`.
- Run `npm run build` in Scene Forge once; the commands below use `node dist/cli.js`.
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
   `shell`. Paired roles may tag several nodes; the others must tag exactly one.
3. Describe the targets in a manifest (`schema --kind littlewild-export --raw`):

   ```json
   {
     "schemaVersion": 1,
     "kind": "littlewild-export",
     "target": "../../../littlewild/source/assets",
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

   `target` is relative to the manifest. `materials` replaces a model material for
   that variant, so one recipe can produce several species. `parameters` sets model
   parameters.
4. Preview, write and check:

   ```sh
   cd docs/concepts/scene-forge
   node dist/cli.js -p examples/pocket-pet littlewild sync --file examples/pocket-pet/littlewild.export.json --dry-run
   node dist/cli.js -p examples/pocket-pet littlewild sync --file examples/pocket-pet/littlewild.export.json
   node dist/cli.js -p examples/pocket-pet littlewild sync --file examples/pocket-pet/littlewild.export.json --check
   ```

   Each result lists the definition path, whether it changed, per-variant
   vertices/triangles and warnings. `--check` fails with `LITTLEWILD_STALE` when a
   committed definition differs from its recipe. One model can also be exported
   with `littlewild export --model <id> --family <family> --variant <name> --out
   <target>/<family>/<id>/definition.json`.

The exporter replaces only the variants it produces. Other variants, gameplay
facets, actor behaviors and existing rigs are retained. Lights are skipped.

## Edit an existing Littlewild asset

```sh
node dist/cli.js -p my-project littlewild import --definition ../littlewild/source/assets/creatures/sproutling/definition.json
```

Each variant becomes a model such as `sproutlingWorld`. Engine primitives are
imported as `lw-soft`, `lw-cone` and similar geometries using the engine's exact
shapes, and pet rigs become `rig:<role>` tags. Export the edited models back with
a manifest that names the same family, ID and variants. Littlewild-only flags
without a Scene Forge equivalent (`castShadow`, `receiveShadow`, `depthWrite`) are
not carried through an import/export round trip.

## Confirm success in Littlewild

```sh
cd ../littlewild
npm run build
npm run typecheck
node .generated/test-assets.cjs
node .generated/test-pet-catalog.cjs
```

The build validates every definition through the asset catalog, and the pet
catalog test resolves each species' stage models and props. Open the maker's
**Pet demo** to inspect the result. These checks validate data and rendering
contracts; they do not certify Blender or Godot imports.
