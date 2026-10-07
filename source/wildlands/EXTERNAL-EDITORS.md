# Offline external editor exchange

The World & Scene Editor's **External editor exchange** disclosure exports a
selected scene as a real Tiled JSON map (`.tmj`), LDtk project (`.ldtk`), or glTF 2
scene (`.gltf`). The complete canonical pack travels with that selected scene:
world configuration, scene hierarchy and connections, native starting state,
paid jobs, inventories, definitions, creature catalogs and visual assets.

Import creates a detached, validated conversion review. **Cancel** receives focus
first. **Apply to draft** replaces only the draft through its existing revision
and undo authority. A draft edit after conversion invalidates the review. Export
requires a completely valid draft. The active player engine never changes during
conversion, import, export, cancellation or draft application.

## Tiled

Exports are finite orthogonal maps with square 32-pixel cells, an inline two-tile
terrain tileset, ordinary tile layers, colored rectangle terrain guides, and a
canonical entity object layer. Tiled's JSON format has no inline raster image data;
the tileset therefore has no external raster thumbnail. The colored grass/water
rectangle guides provide visible terrain without an image download.

Move companion, building, finite-resource or scenery objects on the grid. Unchanged
physical worker positions are preserved exactly, including fractional travel
coordinates in progressed starting states. Edit
creature inventory in the object's `inventory` JSON String property and native
finite resource stock in `stock`. Edit a terrain guide's `canonicalTerrain`
property (`grass` or `water`) and integer `height`, or edit its corresponding tile
layer. The two terrain projections reconcile against the original pack;
conflicting changes are rejected. Rotations, flip flags, encoded/compressed tile
data, infinite maps, external tilesets, shape geometry and deletion are rejected.
Custom object properties are reported as ignored rather than becoming gameplay.

## LDtk

Exports conform to the official LDtk 1.5.3 project JSON schema. They include
entity/layer/field definitions, level instances, actual entity `px` coordinates,
canonical String fields and an IntGrid terrain layer with Grass/Water values.
Entity fields `EntityId`, `Category`, `Inventory` (JSON String) and `Stock` select
native state. Change IntGrid values to edit terrain; Unchanged fractional native positions are retained through metadata while LDtk
uses ordinary integer pixel coordinates. Level `Heights` retains its
integer height projection. External levels, AutoLayers, tile/image geometry and
unmapped types are rejected. Catalog image/enum references are never fetched.

Full-pack metadata uses numbered String properties/fields of at most 8,000
characters. Keep `LittlewildParts` and `Littlewild000`, `Littlewild001`, … fields
when saving in either editor. These are normal editor-owned fields rather than
renamed native JSON documents.

## Blender and Godot

The glTF export contains actual indexed box proxy meshes and colored materials for
companions, buildings, resources, scenery and terrain. These are placement proxies,
not exported native animated models. The canonical primitive assets stay inside
metadata and are preserved without geometry conversion.

Native grid X/Y becomes glTF X/Z. Move entity nodes with whole X/Z translations.
Entity Y must remain zero after all parent translations. Bound interior exports use
the real native floor coordinates and dimensions; outside views keep the fixed
19×19 island topology and its existing world stride. Terrain node Y is native
height; edit `extras.terrain.ground` for grass/water. Native inventory and node stock
are in node extras. Parent translation is accumulated; rotations, nonidentity scale,
matrices, skins, animations, required extensions and external buffers are rejected.
Mesh/material/texture edits do not rewrite native assets; the review states that
limitation. Supported embedded buffers and GLB JSON/BIN chunks are bounded and
reference-checked, while their geometry remains visual exchange data.

Canonical metadata lives in custom String properties on the stable **Littlewild
canonical metadata** root node. Preserve that node and enable **Include Custom
Properties** when exporting from Blender. In Godot, preserve imported node extras
and export **GLB** when bringing the scene back to Littlewild. Standard GLB 2 JSON
and BIN chunks are admitted. A `.gltf` referencing a separate `.bin` or image is
rejected; files and URLs are never resolved automatically. Conflicting metadata
copies are rejected instead of choosing one silently.

## Files authored elsewhere

A generic import requires an explicit canonical pack, selected scene and mappings.
An existing `entityId` mapping updates that native entity. A `templateId` mapping
creates distinct native instances using the existing draft's canonical clone
helpers, including their ID/cardinality checks. Tiled object names, LDtk `EntityId`
fields (or instance IDs), and glTF node names supply stable instance IDs. No converter
invents an inventory, purchases land or silently resets paid progress. Repeated
IDs, unknown templates, unsupported interior movement and invalid native geometry
fail the complete conversion without changing its source or draft.

```json
{"pack":"<complete canonical pack object>","sceneId":"operations-shift",
 "mappings":[{"externalType":"Worker","category":"creatures","templateId":"c1"}],
 "terrain":{"1":"grass","2":"water"}}
```

The UI accepts an entity mapping array, or an options object containing `mappings`
and `terrain`. Add native objects to a metadata-rich export in the native draft
first; a newly invented external canonical identity is rejected with that guidance.
Canonical deletion likewise requires the native reference review.

## SDK and CLI

Browser `LWDeveloper.externalEditors` and Node `toolbox.externalEditors` expose `formats()`, `detect(input)`,
`export(pack, sceneId, format)` and `import(input, options?)`. Imports return either
`{ok:true,pack,sceneId,format,warnings}` or `{ok:false,errors,warnings}`. GLB inputs
are ordinary `Uint8Array` values. Results are detached. Callers own their existing
review boundary and must explicitly apply the successful pack to a draft.

```sh
node .generated/tools/scenario-cli.cjs external-export pack.json operations-shift tiled office.tmj
node .generated/tools/scenario-cli.cjs external-export pack.json operations-shift ldtk office.ldtk
node .generated/tools/scenario-cli.cjs external-export pack.json operations-shift gltf office.gltf
node .generated/tools/scenario-cli.cjs external-import edited.glb reviewed.pack.json
node .generated/tools/scenario-cli.cjs external-import generic.tmj reviewed.pack.json mapping-options.json
```

CLI diagnostics and warnings are structured JSON on stdout. Successful writes use
unique temporary files and atomic replacement. Inputs cannot be overwritten through
an output alias. Exit 1 means conversion rejection; exit 2 means syntax or file IO
failure. Conversion never writes the output on rejection.

All external inputs retain the shared 8 MiB, 60,000-value, depth-24 JSON boundary,
finite numbers, dense arrays, duplicate-key rejection and safe own-property checks.
No scripts, loaders, external schema URLs or arbitrary callbacks are installed.
LDtk's rectangular projection additionally caps 20,000 cells; select a bounded
island scene when a sparse world would produce an oversized rectangle.

## Format references and regression evidence

The converters were checked against the primary format sources:

- [Tiled JSON map format](https://github.com/mapeditor/tiled/blob/master/docs/reference/json-map-format.rst)
- [LDtk 1.5.3 JSON schema](https://github.com/deepnight/ldtk/blob/master/docs/JSON_SCHEMA.json)
- [glTF 2.0 schema](https://github.com/KhronosGroup/glTF/tree/main/specification/2.0/schema)

`fixtures/external-ldtk.schema.json` retains the official LDtk schema.
`fixtures/external-gltf.schema.json` bundles official glTF references locally,
rewriting only relative schema references and removing per-file IDs for offline
validation. No external schema is loaded at runtime.

`test-external-editors.cts` exercises full Office roundtrips, actual placements,
inventory/stock/terrain edits, world/config/catalog preservation, native template
creation, official schemas, GLB chunks and corrupt references, prototype/sparse
inputs, and unchanged drafts/engines. `test-external-editor-cli.cts` exercises real
processes and atomic outputs. `verification/external-editors-browser.ts` exercises
actual downloads, file imports, Cancel-first reviews, stale review rejection,
explicit draft application and generic template authoring at desktop/mobile widths.
