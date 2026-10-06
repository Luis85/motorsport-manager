# Obsidian Canvas scene interchange

The World & Scene Editor's **External editor exchange** exports a real `.canvas`
file for **Obsidian Canvas / JSON Canvas 1.0** or **Obsidian Advanced Canvas**.
Open the file in your Obsidian vault, edit the graph, save it, and choose **Import
external file** in Littlewild. The conversion preview lists world, scene and
connection counts, selected scene, changed labels and limitations. **Cancel**
retains the draft and its revision; **Apply to draft** replaces the detached,
validated whole pack. The active game changes only through the separate native
**Review & play** flow.

Worlds and scenes are named group nodes. Move a scene's whole group inside another
scene group to change its parent, or inside another world group to change its world.
A child must fit completely within one unambiguous immediate parent. Resize groups
when needed. Overlapping possible parents, equal group bounds and missing world
containers reject. Group labels become native world/scene names. Directed edges
between scene groups become real native connections, including cross-world travel;
edge labels become connection labels. The one arrow endpoint determines direction.
Undirected and bidirectional edges reject. Opaque Obsidian edge IDs acquire stable
canonical IDs; existing exported connection IDs survive source/target changes.

**Canvas pixels describe the authoring graph.** Moving or resizing groups does not
move creatures, change world tile bounds, alter collision or resize a native room.
Native scene bounds, props, bindings and physical state remain in canonical JSON.

Each group has a normal text node whose first line is `Littlewild world` or
`Littlewild scene`, followed by editable JSON. Scene `properties` supports native
`description`, `graph` and `settings`. Its graph can edit kind, physical bounds,
requirements, events, island/interior bindings, cosmetic props, renderer selection
and embedded views. Use compiled renderer IDs `basic`, `pixi-2d` or `excalibur-2d`;
PixiJS and Excalibur require 2D. Parents and connections come from visual groups and
edges; putting `parentId` or `connections` in scene properties rejects. World
properties expose the existing validated world profile fields, including terrain,
resource generation and environment. These are authoring data, with the same
native validation as the scene editor. Bound scenes cannot override source settings.

Connections with requirements/events have separate `Littlewild connection` text
nodes. Their JSON references `edgeId`; change `requirements` or `events` there.
Multiple connection configs have separate positions above the scene's child groups.
When deleting an edge, remove its associated config node as well. Deleting a group
requires removing its config, child groups and referenced connections first.
Deleting the selected scene rejects until another scene is selected for conversion.

To add a world or scene, create a group and matching config text node with a new
canonical `id`, its exact Canvas `groupId` and an explicit existing `templateId`:

```json
{
  "groupId": "new-canvas-scene-group",
  "id": "new-level",
  "templateId": "first-morning",
  "properties": {
    "description": "A new native level copied from the chosen scene.",
    "graph": {"kind": "dungeon", "rendering": {"dimension": "2d", "rendererId": "pixi-2d"}}
  }
}
```

Place the group inside its world or parent scene and draw its connections. A scene
template supplies canonical native starting state and inventories; the Canvas does
not invent a second entity simulation. Island/interior bindings select existing
native authority and require valid source ancestry, land/building/floor references.

The complete pack, including all catalogs, worlds and native starting states, stays
in ordinary text nodes: `Littlewild exchange` contains a chunk descriptor, and
`Littlewild exchange part N` contains the corresponding JSON fragment. This avoids
relying on custom root fields that another editor might strip. Keep these nodes
unchanged. Missing, duplicated or altered invalid chunks reject. Chunk positions
are regenerated on export and do not accumulate inside the native pack.

Pack storytelling is also editable in a standard `Littlewild storytelling` text
node. Its JSON retains cutscene tracks/keyframes/timed cues, completion events,
storyboards, ordered shots, cross-world scene/cutscene references and narrative
notes. Large storytelling config uses explicitly numbered text chunks within the
same decoder limits. Scene graph config accepts compiled `play-cutscene` and
`scene-switch` events once their targets exist. Import validates the whole pack;
Canvas never runs a timeline, interprets script callbacks or changes active scenes.

## Generic Canvas mapping

Files made elsewhere require the explicit canonical pack/scene plus `canvasMappings`.
The browser's **Canonical mappings JSON** field accepts an options object. Map each
world group and each scene group/text node to an existing `entityId`, or copy an
existing `templateId` using a new `id`. An unmapped text annotation is visibly warned
and omitted; unmapped groups reject. Plain scene text becomes its native name.

```json
{
  "canvasMappings": [
    {"nodeId": "world-group", "kind": "world", "entityId": "littlewild"},
    {"nodeId": "start-card", "kind": "scene", "entityId": "first-morning"},
    {"nodeId": "next-card", "kind": "scene", "templateId": "first-morning", "id": "next-level"}
  ]
}
```

Use IDs that actually exist in the selected pack. Scene cards inside a mapped world
inherit it; standalone mapped cards retain the explicit native template's world.
Directed card edges create native connections. Canvas nodes never become placed
creatures or tile cells by treating their pixel coordinates as physical positions.

The scenario CLI exposes the same codecs and whole-pack admission:

```sh
node .generated/tools/scenario-cli.cjs external-export pack.json first-morning canvas world.canvas
node .generated/tools/scenario-cli.cjs external-export pack.json first-morning advanced-canvas advanced.canvas
node .generated/tools/scenario-cli.cjs external-import world.canvas edited.pack.json
node .generated/tools/scenario-cli.cjs external-import generic.canvas edited.pack.json mapping-options.json
```

CLI mapping options also include `pack` and `sceneId`. Failed conversion preserves an
existing output file. CLI conversion performs no active game/draft replacement.

## Advanced Canvas support and limits

The plugin dialect uses `metadata.version: "1.0-1.0"` with `frontmatter` and optional
`startNode`. Supported inert visual fields survive native pack export/reimport:
node color, pixel geometry, `dynamicHeight`, `ratio`, `zIndex`, group `collapsed`,
`styleAttributes` (including official shape, border and text alignment), edge
color/sides/ends, `fromFloating`/`toFloating` and official path/arrow/pathfinding
style attributes. Bounded custom style strings/null are retained with a visible
warning; Littlewild does not render plugin CSS. Frontmatter supports at most 32
bounded scalar values. A mapped `startNode` stays portable.

`pack.canvasAuthoring` stores only versioned graph layout/style data. It does not
participate in simulation, physical placement or scene ownership. Native draft
changes prune deleted canonical authoring references; native hierarchy changes
regenerate conflicting graph geometry while retaining styles. Incoming dangling
layout/style references still reject.

Unsupported backgrounds, unknown node/edge fields and unsupported plugin metadata
produce conversion warnings and are omitted. File nodes, URL nodes, portals and
interdimensional edges require conversion to local text/ordinary connections first;
file/URL nodes reject. The converter never reads local vault content, fetches URLs,
executes authored code, installs plugins or registers authored handlers. Plugin
behavior such as portal loading, presentations, CSS execution, search and automatic
resizing is outside the supported interchange.

Admission keeps the shared 8 MiB, 60,000 JSON values, depth 24 and 10,000-character
per-string decoder limits. Canvas additionally supports at most 256 nodes, 512
edges, 200 metadata chunks of 8,000 characters, bounded integer pixel coordinates,
32 style attributes per visual record and native world/scene/connection limits.
Large valid native packs may exceed the Canvas node/chunk budget and then reject
export explicitly. Duplicate IDs, dangling references, hierarchy/binding/embed
cycles and invalid scene properties reject before draft or game mutation.

## Pinned primary specifications and evidence

- [Official JSON Canvas 1.0 specification](https://github.com/obsidianmd/jsoncanvas/blob/456f843cb293df4f4ab1763e22ccb46a80b307c8/spec/1.0.md),
  version 2024-03-11; repository commit `456f843cb293df4f4ab1763e22ccb46a80b307c8`.
- [Advanced Canvas format types](https://github.com/Developer-Mike/obsidian-advanced-canvas/blob/4b8630c641bec6f6329adb8436a4d35752280d74/assets/formats/advanced-json-canvas/spec/1.0-1.0.d.ts)
  and [format specification](https://github.com/Developer-Mike/obsidian-advanced-canvas/blob/4b8630c641bec6f6329adb8436a4d35752280d74/assets/formats/advanced-json-canvas/spec/1.0-1.0.md),
  commit `4b8630c641bec6f6329adb8436a4d35752280d74`.
- [Plugin style attribute definitions](https://github.com/Developer-Mike/obsidian-advanced-canvas/blob/4b8630c641bec6f6329adb8436a4d35752280d74/src/canvas-extensions/advanced-styles/style-config.ts).

`source/test-external-canvas.cts` covers whole-pack graph preservation, actual
rename/reparent/add-world/add-scene/connection/config edits, generic mapped Canvas,
Advanced Canvas styles through native export, reversed arrows, malformed input,
authoring pruning, unchanged active state and actual CLI file conversion.
`source/verification/external-canvas-browser.ts` downloads and uploads edited
`.canvas` files at desktop/mobile widths, checks Cancel focus and revision retention,
explicit draft application, style reexport, invalid file rejection and no network
requests. These are codec and browser exchange proofs; they do not claim a running
Obsidian plugin session or human usability validation.
