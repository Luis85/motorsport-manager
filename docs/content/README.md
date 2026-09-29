# External content

Status: vehicle and roster vertical slices are executable. Tyre, setup and wider
mechanic extraction remain separate, unfinished increments of the requested plan.
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

Vehicle definitions are typed/frozen at compilation. The session checkpoint and
replay identity retain their exact definition. Editing/removing a source pack
cannot change that continuation. Old saves/direct APIs still use the frozen
legacy four-preset adapter. A new preset is not a new sporting format.

`python3 scripts/verify_content_export.py --godot /path/to/godot` exports Linux
debug and release, runs each from an isolated directory with no source tree,
edits the fifth vehicle without rebuilding, rejects a malformed edit, deletes
the source pack, and compares the restored session. This is Linux headless
acceptance, not Windows execution or human usability evidence.

## Teams, drivers and event rosters

Team and driver definitions are separate from the ordered event roster. A roster
references drivers and teams by stable ID, assigns unique car numbers and a pit
fraction to each team, and selects its player team. This rule family supports
two cars per team and 2–24 entrants. A circuit must have enough authored grid
places and six metres between team service positions. Launch and restore share
that geometry policy; a larger catalog does not silently enlarge a circuit.

The example pack includes `local.club.roster.expanded`: fourteen cars, with Avery
Shaw and Robin Vale as the managed pair in slots 12 and 13. Choose it in FIELD.
In the circuit editor, set a suitable circuit's grid count to fourteen or more
before launching that field. Names and per-entry livery overrides are cosmetic;
an empty entry color inherits its team's color. Names do not grant permissions
or determine a pit box.

A new session stores the roster and exactly its referenced driver/team definitions.
For authored sessions the existing car `team` field stores a stable team ID;
application read models add the display label. The 91-field car codec remains
unchanged, including its exhaustive regression assertion. Old checkpoints still
use the explicit frozen legacy roster; they do not read today's editable packs.
Results, recordings, public timing, strategy and native views use actual entrant
counts and managed IDs rather than slots 3 and 6. Named old MER/MOR training goals
remain restricted to the corresponding named participants; they are not relabeled
as achievements for a different driver.
