# Content consumer inventory

`consumer-inventory.json` is the machine-checked ownership register for every leaf
in every published `content/schemas/v1/*.schema.json` contract. It answers two
questions before a new authored field can ship: **what kind of authority is this
field**, and **which production code owns its interpretation**.

The inventory uses the classifications `contract`, `identity`, `presentation`,
`reference`, `authoring`, `sporting`, `simulation`, and `safety`. A prefix may
own a whole bounded object/array (for example `/environment` or `/placements`);
the regression test expands the generated schema to leaf paths and requires every
leaf to resolve to an inventory entry. Unused/stale prefixes, missing production
files, unknown classifications, duplicate prefixes, new schema files, and
unclassified new fields fail the test.

The same JSON also registers deliberately retained code literal tables and
structural/safety bounds. Those entries must name a live symbol, classification
and rationale, so compatibility constants cannot masquerade as unfinished tuning.

This is an ownership/coverage audit, not proof that a coefficient is well balanced
or that every code path is exercised. Semantic behavior remains covered by the
family-specific native suites and the final full-source gate. The inventory makes
the boundary explicit: presentation data cannot silently become sporting
authority, authoring profiles cannot load code, and safety/contract fields are not
misrepresented as ordinary tuning.

When changing a schema, update the production consumer and its tests first, then
update the inventory entry in the same change. Do not add a broad catch-all prefix
to make the coverage test pass.
