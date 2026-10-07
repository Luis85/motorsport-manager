# World & Scene Editor

Open **Worlds & scenarios → Open World & Scene Editor** to author a complete
scenario pack. The left panel lists its worlds and nested scenes. World selection
edits terrain, resource generation and environment settings; scene selection edits
level properties, children, bounds, connections, entry requirements and events.
Definitions, presentation and asset catalogs remain shared by the complete pack.
Per-world configuration uses each world's existing `WorldProfile` authority.

Select a companion, building, physical item/resource node or scenery prop in the
inspector, choose **Move on grid**, then select a tile. Arrow keys navigate the grid;
Enter selects or places. Inspector fields edit the canonical creature inventory,
native building/resource state or authored scenery values. Add entities by copying
an existing canonical template and choosing an ID and position. Unsupported
positions, references or values fail without changing the revision. Paid work and
layout ownership still use the existing validators.

Inventory items are carried by native creatures; placed physical resources use
native finite node stock. Cosmetic props reference an existing asset and model and
have no independent inventory, collision or production authority. Props appear in
the selected scene through the default 3D renderer, canvas fallback, visited room
renderer and detached custom renderer frame. Scene changes replace their projection.

The editor owns a detached draft and up to twenty undo revisions. Validation,
placement, import and export never change the active player engine. Imports replace
the entire validated pack, including removal of omitted optional catalogs. Export
writes ordinary `living-worlds-pack` schema 2 JSON accepted by the scenario CLI.
**Review & play** validates a concrete scene and opens the existing replacement
review with Cancel and backup export before explicit launch. Cancelling retains
the draft. Opening the same pack again retains edits; replacing an edited draft
with another pack requires its concrete Cancel-first review.

The **External editor** toolbar exports the selected scene for Tiled, LDtk or
glTF exchange with Blender/Godot. Imported external files produce a detached
conversion review with explicit warnings and Cancel before **Apply to draft**.
Mappings identify canonical entity templates for files authored elsewhere. The
complete pack remains the authority; conversion never starts another simulation
or applies a draft to the active story. External assets are never fetched during
import.

## Scene topology and admission

`Scene.graph` is an optional compatible schema 2 extension. Existing packs and
fixtures continue to export unchanged. A graph defines `kind`, optional `parentId`,
`bounds`, `connections`, `requirements`, `events`, `binding`, `props` and `rendering`.

- `level` and `dungeon` have canonical native initial states and dormant checkpoints.
- `island` binds an owned `(ix, iy)` in an unbound ancestor source scene.
- `interior` binds a source building and its stable `floorId`.

Bound scenes have empty `initialState`; entities, paid jobs, visits, stations and
room geometry belong to the source native scene. Their selection changes the
player's view without moving companions. Interior bounds are room coordinates and
must fit the canonical floor. World/island child bounds share their parent's world
coordinates. Parent cycles, dangling connections, orphan bindings, mismatched
worlds and unsupported floor/island references are rejected. Deleting a referenced
scene or occupied world requires removing its references first.

Requirements select compiled handlers: guide level, completed quest, existing
building kind or total carried item quantity. They gate direct launches against
the starting state and connections against the actual source state. Events select
compiled message and pause effects; authored JSON cannot provide a module or
callback. A reviewed connection checks the exact source engine/context and rejects
stale or altered reviews before changing the active context.

Scene journeys persist the whole authored pack plus native owner checkpoints in
the portable story's optional experience context. Shared resource catalogs are
stored once in that journey; native states hydrate them through the same validated
catalog authority. Dormant checkpoints never tick. Returning restores unfinished
work, inventories, RNG and scene settings. Each scene's camera is a presentation
preference retained during a browser journey; bound scenes focus their real island
or floor. A restored portable story opens its saved bound island or interior floor;
a new story starts a fresh camera lifetime. See [WORLD-SCENE-RUNTIME.md](WORLD-SCENE-RUNTIME.md) for admission and save
contracts.

The existing JSON decoder bounds remain: 8 MiB authored pack/journey input,
60,000 visited JSON values and depth 24. The portable story retains its existing
12 MiB envelope and the same value/depth constraints. Up to eight worlds, sixty-four
scenes, thirty-two outgoing connections per scene and 128 props per scene are
accepted within those aggregate limits. First-launch and checkpoint growth are
preflighted; rejected imports or transitions retain the source engine and active
registries. Large repeated catalogs are compacted in saved journeys rather than
raising the shared decoder limits.

## Rendering and embedded views

Scene rendering selects `dimension: '2d' | '3d'` and a compiled renderer ID:
`basic`, `pixi-2d` or `excalibur-2d`. Basic selects the existing 3D or canvas
presentation; PixiJS and ExcaliburJS require 2D scenes. Embedded minimap/panel
views reference authored 2D scenes with bounded corner anchors and pixel sizes.
They observe canonical owner state without another engine clock. Dangling targets,
duplicate view IDs and recursive embeds are rejected. The rendering selector and
embedded view rows are in Scene properties.

## Typed tools

`LWDeveloper.createSceneEditor(pack)` exposes the same detached draft
authority to browser and Node callers. `session.sceneConnections()`,
`sceneTarget()` and `sceneProps()` return detached queries.
`session.reviewScene(connectionId)` returns a public review without an engine or
private preview; `session.enterScene(review)` accepts only the original reviewed
capability and atomically replaces the session's owned engine after successful
admission. A failed activation retains its lease and source state. Standalone
catalog replacement is refused while a journey owns its complete pack; edit and
review that pack instead.
