# Authored buildings and staged improvements

The building designer sits beside the researched blueprint catalog. Choose an existing supported building type, paint flooring and wall/window/door edges, place workstations, connect floors with stairs, choose a builder and send a construction plan. Existing blueprint placement remains available.

An authored design is geometry and a label. Its `kind` selects an already compiled building mechanic and existing recipe/production rules. Data cannot introduce new task kinds, capabilities or executable handlers. A per-world `construction` record stores immutable design versions; orders and finished buildings reference them with `designId`. `LWInteriors.forBuilding` resolves that same saved `LWInterior.Layout` for indoor routing, workstation bindings and rendering. Catalog globals are never replaced to apply a design.

## Geometry

A design draft has `{name,kind,layout,mapUnit?}`. Layouts contain one to eight floors with stable IDs, widths/heights from 4 to 20, an entrance point, stairs and stations. Optional `cells` select up to 400 floor tiles. Optional `edges` specify tile coordinates, a north/east/south/west side and a wall/window/door kind. Windows block movement; doors allow passage. Every cell, station and stair must be reachable from the floor entrance. Floors must have reciprocal reachable routes through stair connections.

The ground entrance faces south within the first four interior columns. A footprint is derived from the ground-floor dimensions: new designs use four interior tiles per map tile. Explicit bounded `mapUnit` metadata preserves the existing exterior scale when improving a standard building; a purely vertical addition keeps its original footprint. Expanding the ground floor reserves additional foundation tiles. The footprint extends east and north from the entrance anchor. Upper-floor cells require existing ground support. The whole footprint must stay on owned, flat grass, keep existing buildings, companions and resource deposits accessible, and preserve settlement connectivity. Construction reserves every footprint tile; standard placement also honors those reservations.

Farms use the same required substrate, carried inputs, production reservations and finite or sustainable harvest rules as their existing building type. Enlarging a drawn plot does not create soil, water, inventory or extra harvest output.

## Physical work

Submitting a plan spends no materials and creates no finished building. The assigned creature must source and carry the current stage’s materials, reach the site and complete foundation, structure and fittings stages. Paid stage progress survives interruptions and checkpoints. Existing construction attempts, practice, setbacks, cancellation refunds and salvage behavior apply.

Design geometry adds finite wood, stone, glass, planks and fiber requirements to the existing base blueprint cost. Improvements charge positive material differences plus reinforcement. The existing building remains usable with its old design until the last physical stage finishes. Floor, entrance, station and stair IDs already in use must remain supported. Redesign submission rejects paid production or active visits, and final activation waits for later occupants to leave. The editor follows the existing pause-on-open preference. Closing the designer keeps its local draft; rejected commands preserve world state.

## Programmatic access

The same command router serves UI and the typed developer SDK:

```ts
session.command({id:'construct-design', actorId:'c1', args:[draft, x, y]});
session.command({id:'improve-design', actorId:'c1', args:[buildingId, improvedDraft]});
```

Detached queries expose available supported types, saved reusable designs, a building’s editable draft and validated cost/phase previews. Native saves, portable stories and captured scenario initial states contain the complete authored design values and unfinished physical orders. Import validates known kind references, footprint derivation, sequence identities and staged work before restoring them, then rejects inaccessible or invalid foundations without changing the active resource catalogs. Worlds without authored design state retain their standard behavior.
