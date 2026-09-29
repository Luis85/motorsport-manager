# External content

Status: vehicles, rosters, tyres/allocations, setup, shared race tuning, named
weekends, weather/surface calibration, scalar reliability, incidents and supported
virtual race-control settings, shared AI/racecraft tuning and externally named rival
profiles are implemented. The catalog also accepts file-authored circuits, supported
illustration styles and complete-weekend scenario briefs. Built-in tracks use their
original files, not a duplicated track format. The authoring CLI provides listing,
resolved inspection export, comparison and bounded scenario execution.

Wheel operating coefficients and registered provider selection are now authored.
The six shipped developer diagnostic collections are also bounded file-backed resources;
practice and rival recipes no longer live as executable GDScript tables, and every
collection owns its bounded gallery title/description. Circuit Atelier placement presets
and its contextual-guide copy are now a bounded authoring-only editor profile. Exhaustive consumer inventory and final full-plan acceptance remain unfinished. This is not a claim that every work package is complete.
See [weekends and shared tuning](weekends-and-tuning.md) for the new authoring path.
See [tyres and setup](tyres-and-setup.md) and [teams, drivers and rosters](rosters.md) for external field authoring and limits.
The reference program is native Godot 4.7.2. No browser runtime is introduced.

## Author a vehicle without rebuilding

Copy `content/examples/club-racing` outside the source tree. Keep `pack.json` and
its relative files together. Edit `vehicles/sport.json` in a text editor. Launch
an exported executable with `-- --content-pack=/absolute/path/to/club-racing`.
The setup CAR selector and track-editor vehicle selector use the validated
catalog. Alternatively, put an array of explicit pack-folder paths in the
`content_roots` setting in `user://settings.json`. Neither route executes scripts.

For source authors:

```sh
python3 scripts/content.py init ./my-pack --id local.club
python3 scripts/content.py clone core.vehicle.gt --as local.club.vehicle.new --pack ./my-pack --godot /path/to/godot
python3 scripts/content.py validate ./my-pack --godot /path/to/godot
python3 scripts/content.py inspect ./my-pack --id local.club.vehicle.new --godot /path/to/godot
python3 scripts/content.py schemas --check --godot /path/to/godot
```

`--format json` emits machine-readable output. Validation invokes the production
Godot compiler; a missing engine or a dry authoring operation never claims that
engine validation happened. Cloning refuses overwrites, uses a cooperative lock,
and rolls back a newly created definition if manifest replacement fails. This is
not a crash-durable, concurrent external-writer transaction protocol.

## Contract

The executable schema contract is `ContentSchema`; checked-in JSON Schemas are
its generated, checkable projection, not a separately edited validator. Only the
schema vocabulary emitted by that class is supported. Stable dotted IDs identify
content. Manifest order is deterministic; arrays are not sorted for hashing.
Dependencies require an exact pack version and must be listed before dependants.
A duplicate definition requires an explicit whole-record override with the prior
resolved SHA-256. `inspect` shows the resulting value and its source chain.

JSON is strict: no comments, trailing commas, duplicate keys, non-finite values,
wrong scalar types, or unknown fields. UTF-8 is checked before decoding. Folder
entries cannot escape the selected root or traverse symlinks. Limits are 32 packs,
2048 files, 1 MiB per file, 16 MiB total, and 24 nested levels. These limits cannot
be changed by a content pack. The numeric parser bounds token length/exponents;
individual schemas impose tighter game-specific ranges.

Vehicle and entrant definitions are typed/frozen at compilation. The session checkpoint and
replay identity retain their exact definition. Editing/removing a source pack
cannot change that continuation. Old saves/direct APIs still use the frozen
legacy four-preset and twelve-driver adapters. A new preset is not a new sporting format.

`python3 scripts/verify_content_export.py --godot /path/to/godot` exports Linux
debug and release, runs each from an isolated directory with no source tree,
loads fourteen drivers, six compounds and ten sets per driver; edits vehicle,
tyre wear, setup, fuel/service tuning, weather/surface, operations, AI profiles and weekend lap counts without rebuilding; rejects malformed and conflicting edits; deletes
the source pack; and compares the exact restored session. This is Linux headless
acceptance, not Windows execution or human usability evidence.

Weather/surface coefficients and their compatibility rules: [authoring guide](weather-and-surface.md).

Scalar condition, driving incidents and virtual control: [authoring guide](reliability-and-control.md).

AI, passing opportunities and coordinated pit forecasts: [competition authoring guide](competition-and-ai.md).


Circuits, illustration styles, briefs, native review and authoring commands:
[circuit/scenario guide](circuits-and-scenarios.md).

Circuit Atelier placement presets and text-only guide customization:
[editor profile guide](editor-profiles.md).

Exact saved-state number decoding and retained replay integrity:
[persistence contract](persistence-numbers.md).

## Multiple packs and authoring safety

See [Multi-pack authoring](multi-pack-authoring.md) for ordered selections, dependency-aware cloning, comparing resolved sets, and write-failure behavior.

Additional authoring contracts: [Mechanic profiles](mechanic-profiles.md),
[version compatibility](version-compatibility.md), and the wheel operating-limit
section of [tyres and setup](tyres-and-setup.md).
