# Create your first content pack

This tutorial adds a custom GT vehicle to the existing car selector. You will
create a folder pack, clone a shipped vehicle, change its display name, validate
it and load it in the native game. Run the commands from the repository root.
Use the pinned Godot **4.7.2.stable.official.ed1daf0bf** binary for native checks.
Choose a new destination directory; `init` refuses an existing directory.

## 1. Create the pack and clone a vehicle

```sh
python3 scripts/content.py init /tmp/my-club-pack --id local.club
python3 scripts/content.py clone core.vehicle.gt \
  --as local.club.vehicle.new --pack /tmp/my-club-pack \
  --godot /path/to/pinned/godot
```

Initialization creates `pack.json` and declares the exact built-in core dependency.
It does not run the engine. Cloning inspects the validated catalog, writes
`vehicles/local.club.vehicle.new.json` and adds that path to the manifest.

## 2. Edit and validate

Open the cloned JSON file in a text editor. Change only its `name` to
`My Club GT`, keeping its `id`, `kind`, schema version and vehicle fields intact.
Then run:

```sh
python3 scripts/content.py validate /tmp/my-club-pack \
  --format json --godot /path/to/pinned/godot
python3 scripts/content.py inspect /tmp/my-club-pack \
  --id local.club.vehicle.new --format json --godot /path/to/pinned/godot
```

Validation should exit successfully and return `ok: true` and
`engine_executed: true`. Inspection should show the new name and the definition's
source chain. If validation fails, fix the reported field and repeat this step
before loading the pack. JSON comments, trailing commas and unknown fields are
rejected.

## 3. Load and select the vehicle

Launch an existing Linux export with the pack path (substitute your executable):

```sh
./motorsport-manager.x86_64 -- --content-pack=/tmp/my-club-pack
```

The same application arguments work with an exported executable on other
platforms. To use the source project instead:

```sh
/path/to/pinned/godot --path . -- --content-pack=/tmp/my-club-pack
```

Open weekend setup and select **My Club GT** in **CAR**. The track-editor vehicle
selector also uses the validated catalog. Loading and selecting content do not
start a race; the normal review and **Start practice** flow commits the weekend.
A pack edit affects a new selection, while an existing saved weekend keeps its
frozen vehicle definition.

## Next steps

For a complete authored weekend, copy the entire
`content/examples/club-racing` directory outside the source tree and follow
[weekends and tuning](../how-to/content/weekends-and-tuning.md). Keep its relative files and
`pack.json` together. For dependencies and overrides, use
[multi-pack authoring](../how-to/content/multi-pack-authoring.md) and the
[pack contract](../reference/content/pack-contract.md). To tune the shipped `config/` catalog, use the
separate [balancing guide](../how-to/balancing.md).
