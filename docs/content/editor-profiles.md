# Circuit Atelier editor profile

`editor_profile` is authoring presentation data for Circuit Atelier. It does not
enter a race snapshot, alter physics, execute code or add renderer types. The
application consumes one stable profile ID: `core.editor_profile.default`.
External packs customize it only through the normal whole-record, hash-pinned
override contract. Additional competing profile IDs are rejected so pack order
cannot silently choose a different authoring interface.

The profile owns two bounded authoring surfaces:

- `placements`: 1–32 named scenery presets. A preset selects one of the renderer
  types already supported by the game (`tree`, `grandstand`, `garage`, `tower`,
  `yacht`, `water`, `tent`, `cafe`) and supplies initial scale and rotation.
- `placement_help` and `guide`: text shown by the editor. The five guide keys are
  fixed semantic slots (`shape`, `scenery`, `trace`, `checks`, `handoff`). Code
  owns the target controls and reveal actions for those keys.

A placement writes only the normal TrackDocument object fields `type`, `x`, `y`,
`h`, `scale` and `rotation`. The preset ID is not embedded into the circuit, so
later changes to a profile cannot rewrite existing scenery. Existing objects
remain freely editable through the normal editor transaction/undo path.

## Customize through a content pack

First inspect the resolved default and its provenance/hash:

```sh
python3 scripts/content.py inspect --id core.editor_profile.default \
  --format json --godot /path/to/godot
```

Copy the definition into your pack while keeping the same stable ID. Add an
`overrides` entry in `pack.json` whose `expected_sha256` is the exact resolved
hash reported for the definition you are replacing, then list the JSON file in
`files`. Validate the complete ordered pack set before launching:

```sh
python3 scripts/content.py validate ./my-pack --godot /path/to/godot
```

A stale expected hash, duplicate placement ID, missing/duplicate guide key,
unsupported scenery type, unknown field, or out-of-range transform rejects the
entire candidate catalog. There is no script path, callback, arbitrary scene,
texture URL or executable action field in this schema.

## Compatibility boundary

Direct legacy editor construction without a content catalog retains the original
eight placement choices and guide copy as a compatibility adapter. Normal game
composition supplies the validated content catalog before Circuit Atelier enters
the scene tree, so the checked-in JSON profile is the regular authoring source.
The profile is deliberately not frozen into weekend/replay persistence because it
cannot change an already-authored circuit or a running race.
