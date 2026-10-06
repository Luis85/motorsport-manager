# Example workshop

Open `examples/showcase/exports/workshop.html` for the offline eight-scene demo. Use the scene chooser, Models tab and category filter. Every asset is an editable recipe rather than an opaque imported mesh.

| Example ID     | Focus                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------- |
| `outpost`      | Survey rover, reusable supplies and a small environment.                                           |
| `fieldStation` | A composed field station using nested reusable models.                                             |
| `logistics`    | Parameter-driven shelving, integer repeat counts and nested cargo.                                 |
| `courtyard`    | Townhouses, nested window grids, path-planted trees and a fountain.                                |
| `pipePlant`    | Vessels, valves, catwalks and capped spline pipe routes.                                           |
| `robotCell`    | Hierarchical robot-arm pivots, conveyors and oriented path markers.                                |
| `assetStudio`  | Primitives, three simple characters and eight everyday objects, authored lights and unlit screens. |
| `animationLab` | Seven-joint characters, explicit part bindings, three poses and a waving clip.                     |

The workshop palette contains 43 reusable recipes: seven primitives, three characters, eight everyday objects, plus the architecture, industrial, robotics and earlier project assets. Individual example bundles include only their reachable model dependencies; the all-scenes workshop exposes the entire registry.

## Pocket Pet project

`examples/pocket-pet` is a separate project rather than a workshop scene. It contains 26 recipes: reusable face, leaf, sprout, petal and flower parts; an egg, baby, teen and two adult forms tagged with `rig:<role>` including `hat`, `face`, `neck` and `back` accessory sockets; a room, bed, bowl, snack, ball, mess, medicine, bubbles, heart and star; and six accessories (party hat, bow, glasses, scarf, crown, wings). `littlewild.export.json` publishes them as two species, ten props and six accessories into `../littlewild/source/assets/pets/`. Review the lineup with `forge3d -p examples/pocket-pet review --node lifeStages --out review`.

## Agent entry points

```bash
forge3d example list
forge3d example show pipePlant --raw
forge3d example create courtyard my-courtyard
forge3d -p my-courtyard inspect --source
forge3d -p my-courtyard model list
forge3d -p my-courtyard review --out my-courtyard/exports/review
forge3d -p my-courtyard export --validate --out my-courtyard/exports/scene.glb
```

`example create` refuses an existing destination. Its structured response includes argument arrays for follow-up commands. Use `model inspect` to inspect a recipe, change its JSON, and `model import --replace --dry-run` before replacement. Existing instances retain parameter and material overrides. Use `node edit` or guarded `apply` batches for changes to scene instances.

To rebuild the bundled demo:

```bash
npm run examples:generate
npm run build
forge3d -p examples/showcase preview --all-scenes --out workshop.html
npm run release:showcase
```

The generator is trusted development code. Its outputs are ordinary strict JSON; no code is embedded in recipes. `release:showcase` requires Chromium and creates eight validated GLBs, five six-view reviews, desktop/mobile screenshots and a contact sheet.

## New procedural data

A tube uses centripetal Catmull–Rom interpolation through 2–256 control points, a constant radius and optional caps. Closed tubes need at least three points. Do not duplicate the closing point. Radius and point coordinates accept scalar expressions; tessellation is an explicit bounded integer.

```json
{
  "type": "tube",
  "points": [
    [0, 0, 0],
    [0, 1, 0],
    [1, 2, 0]
  ],
  "radius": 0.1,
  "tubularSegments": 48,
  "radialSegments": 8,
  "capEnds": true
}
```

A path pattern places copies at explicit local coordinates. `orient: "yaw"` points local +Z toward the next point; the final copy follows the last segment. Consecutive points must differ horizontally for yaw. `none` supports vertical paths. The node's transform applies around the whole pattern.

```json
{
  "type": "path",
  "points": [
    [0, 0, 0],
    [2, 0, 0],
    [2, 0, 3]
  ],
  "orient": "yaw"
}
```

Model parameter definitions can include `integer: true`. This rejects fractional floor counts, rows or other discrete dimensions before expansion.
