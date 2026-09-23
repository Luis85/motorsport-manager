# Track contracts

## Native authoring v1

A UTF-8 JSON object with `kind: "motorsport-manager-track"` and `version: 1`. Coordinates use **metres**, +X east, +Y north, +height up. Banking is degrees. Renderer screen Y is inverted; persisted Y is not screen coordinates.

```json
{
  "kind": "motorsport-manager-track",
  "version": 1,
  "id": "custom-example",
  "name": "Example Circuit",
  "closed": true,
  "start": 0.0,
  "nodes": [
    {"id":"a","x":-200,"y":-100,"h":0,"w":12,"bank":0,"mode":"free","in":{"x":0,"y":0},"out":{"x":0,"y":0}},
    {"id":"b","x":200,"y":-100,"h":0,"w":12,"bank":0,"mode":"free","in":{"x":0,"y":0},"out":{"x":0,"y":0}},
    {"id":"c","x":200,"y":100,"h":0,"w":12,"bank":0,"mode":"free","in":{"x":0,"y":0},"out":{"x":0,"y":0}},
    {"id":"d","x":-200,"y":100,"h":0,"w":12,"bank":0,"mode":"free","in":{"x":0,"y":0},"out":{"x":0,"y":0}}
  ],
  "pits": [], "features": [], "objects": [], "timingGates": [],
  "cornerMarkers": [], "grid": {"spacing":8}, "provenance": {}
}
```

The minimal example is a sharp rectangular authoring track, not a finished circuit. Empty pits compile to a generated service lane with a warning. For each road segment, control points are `A`, `A + A.out`, `B + B.in`, `B`. Width, height and bank interpolate along that segment. `start` is a normalized authoring fraction, not a distance in metres.

The packaged catalog uses a compact node representation `[x, y, height, width, bank, in_x, in_y, out_x, out_y]`. Normalization expands it into the same node dictionaries used by the editor; exported authoring files are not required to use compact nodes. Built-in source identifiers do not become arbitrary filesystem paths.

### Nested entities

- `pits`: first entry is the active lane, with `entry`, `exit` fractions, `speed` in km/h, `width`, and `nodes`. The compiler adds joins to the main road. Native movement follows the authored pit nodes as a polyline.
- `features`: range-based records with type, start/end, side and dimensions. Existing additional authoring metadata is retained.
- `objects`: positioned scenery; native rendering understands the source's common objects, but only limited authoring operations are exposed.
- `timingGates`: two `type: "sector"` gates with `f` produce authored sector boundaries. Otherwise the runtime falls back to thirds. Finish is the timing origin.
- `grid`: spacing affects the grid. Other original grid metadata is preserved for external consumers; not every source grid placement option is interpreted by this iteration.
- `reference`: optional base64 PNG, world width, X/Y center and opacity. Do not include an image that cannot legally be redistributed.
- `provenance`, corner markers, and unknown source metadata are retained where normalization permits; retention does not imply simulation behavior.

## Import validation

`TrackDocument.validate` runs before save/import/launch. It checks supported kinds/versions, closed geometry, 4–2000 finite nodes, distinct points and minimum control-polygon length, bounded widths/banking/handles, metadata container types, pit joins/speed, feature/object/gate shapes, and reference sizes. File reads are limited to 16 MB. Invalid documents are reported, not partially applied. Validation is structural and bounded; it is not a proof of drivability, minimum turn radius, intersection separation, or 3D clearance.

## Circuit Atelier migration

The importer recognizes `kind: "circuit-atelier-project"` and versions 1–4, with the v0.4 prototype as the primary migrated baseline. Explicit Bézier handles are retained; missing automatic handles are reconstructed using centripetal tangents. Metre coordinates, width, height, banking, pits, features, objects, timing and provenance are carried over. Old browser checkpoints, embedded HTML, runtime mesh packages, and arbitrary GeoJSON are **not** native authoring imports.

## Baked runtime v1

`kind: "motorsport-manager-runtime"`, `version: 1` is a derived, immutable consumer artifact. It includes coordinate units/axis, name, length, timing-origin fraction, selected vehicle preset, solver identifier, estimated lap time and ordered samples. Each sample carries `s`, `x`, `y`, `height`, `width`, `bank_deg`, `line_offset`, `curvature`, and `speed_mps`.

Samples begin at authoring node zero; `start_fraction` defines the timing origin. The last sample does not duplicate the first: consumers must close the loop. Offsets are left-normal to the sampled centerline. Curvature is inverse metres; speed is metres/second. `sector_ends_m` are measured from the timing origin, unlike sample stations. Pits/features/objects/timing gates/grid/provenance accompany the samples. The package does **not** include a triangulated road mesh, collision mesh, globally optimal trajectory certificate, or an adapter for a commercial racing game.

Changing the interpretation of persisted values requires a schema-version increment and migration tests. Do not silently reuse v1 for an incompatible representation.

## Bundled catalog

`data/tracks/catalog.json` is an ordered manifest (`kind: motorsport-manager-track-catalog`, version 1) listing the eight adjacent circuit JSON filenames. Each circuit is an independent authoring document, so geometry changes stay reviewable per track. `Storage.read_catalog()` resolves only adjacent JSON filenames, preserving the library order; imported user tracks do not control this manifest.
