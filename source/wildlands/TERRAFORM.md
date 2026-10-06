# Terraform the current world

Open **More → Terraform this world**. Choose grass, water, raise, lower, or a
living resource source, then select tiles on the map. The panel lists the pending
changes and validates the entire settlement before **Apply changes** becomes
available. **Clear preview** discards the draft. **Back to map** or **Escape**
leaves the mode without applying anything. Use **F6** to move between tools and
the map; Shift + arrow keys move the map cursor and Enter previews that tile.

Terraform changes belong to the current saved world. They do not replace the
global world profile, change other stories, create executable content, or add
simulation phases. Terrain defaults to the original profile and height zero
when a story has no edits. Water is unwalkable. Height steps range from −2 to 4;
creatures can cross adjacent grass tiles whose heights differ by at most one.
The shared navigation grid applies these rules to ordinary gathering, carrying,
construction and visits. Both the 3D and Canvas maps read the same heights;
floor tiles, sources, foundations, creatures and routes move with the terrain.
Authored indoor worlds preserve their walls and theme while their edited floor
tiles show the new ground and elevation.

Only owned island tiles can be edited, at most 64 changes per transaction.
Bridge corridors are protected. Every committed or reserved construction
footprint must remain flat grass. Doorways, resource approaches and the entire
settlement must stay connected. An edit that erases a source, strands a creature,
blocks a current task or visit route, or loses an active work target is rejected
as one transaction. Existing building inventories, reserved paid jobs, orders,
carried goods and RNG remain unchanged.

Trees and plants reuse the established resource-node records and harvesting
tasks. Choices come from the current world's resource labels and validated
asset models. This matters in themed worlds: the Office's receiving source is
labelled as receiving stock, rather than pretending its rack asset is a tree.
Herbs, grain, fibers and berry sources retain their authored appearances when
available. Planting never grants items directly; a creature must walk to the
new source, work, carry the goods and deposit them through the ordinary system.

The saved `state.terraform` contains version, revision, node sequence, sparse
ground/height overrides and bindings from planted node IDs to their authored
models. `state.nodes` remains the single resource and stock authority. Native
JSON, portable stories and captured scenarios retain both records. Import
validation rejects unknown fields, executable/accessor inputs, unowned tiles,
invalid heights, missing assets, duplicate identities, orphaned bindings and
incompatible node capacities before accepting the story. Context preparation
and preview remain reversible.

The same compiled commands are available to agents:

```ts
const edit = {
  revision: game.terraform().revision,
  tiles: [{ x: 5, y: 5, ground: 'grass' as const, height: 1 }],
  plants: [{ x: 6, y: 5, kind: 'herbs', model: 'world' }],
};
game.command({ id: 'preview-terraform', args: [edit] });
game.command({ id: 'apply-terraform', args: [edit] });
game.terrain(5, 5); // detached ground and height
```

Preview never mutates the save. Apply revalidates and rejects a stale revision.
The SDK queries return detached values and use the session's own scenario
context. The shared command router owns command registration and authorization;
the Terraform transaction service owns application of edits, the state module
owns the JSON boundary, and `LWConstructionGeometry` plus `LWGeography.Grid`
own settlement topology. Rendering and UI only emit intent and draw projections.

`source/test-terraform.cts` covers water walkability, slopes, atomic rejection,
real harvesting of a planted source, preservation of a real reserved paid job,
strict import bounds and exact native/story continuation.
