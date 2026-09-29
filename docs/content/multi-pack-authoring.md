# Ordered multi-pack authoring

The Python CLI uses the production Godot content compiler for acceptance. Core is
always first. Repeat `--pack` in dependency order; an optional positional pack is
loaded last. No folder discovery, sorting or silent dependency downloading occurs.

```sh
python3 scripts/content.py validate ./event --pack ./vehicles --pack ./rules --godot /path/to/godot
python3 scripts/content.py list --pack ./vehicles --pack ./rules --kind weekend --godot /path/to/godot
python3 scripts/content.py inspect ./event --pack ./vehicles --pack ./rules --id local.event.weekend.sprint --godot /path/to/godot
python3 scripts/content.py export ./event --pack ./vehicles --pack ./rules --output ./resolved.json --godot /path/to/godot
python3 scripts/content.py test ./event --pack ./vehicles --pack ./rules --scenario local.event.scenario.sprint --steps 1600 --godot /path/to/godot
```

The paths and IDs above are illustrative. Each pack must declare its exact
versions and list its files in `pack.json`. A missing, wrong-version or out-of-order
dependency is rejected by the same loader as the exported game. A repeated path,
including a relative/absolute alias, is rejected before invoking the engine.
The existing one-pack positional commands continue to work.

## Cloning across packs

`clone --pack` remains the writable destination, not an extra input. Use repeated
`--dependency` options to load its prerequisites. The source can be any definition
in the resulting validated catalog, including a dependency's resolved override.
The destination must use its own namespace and a previously unused definition ID.

```sh
python3 scripts/content.py clone local.vehicles.vehicle.gt --as local.event.vehicle.gt --pack ./event --dependency ./vehicles --dependency ./rules --godot /path/to/godot
```

Cloning does not copy transitive references into the destination, invent missing
dependencies, or change dependency versions. Declare the destination dependencies
before cloning. Cloned circuits receive a distinct internal document identity.

## Comparing two compositions

For `diff`, repeated `--pack` options are shared prerequisites. `--before-pack`
and `--after-pack` add ordered prerequisites for their respective sides. Each
positional root is last on its own side. This supports different versions of the
same dependency without loading those incompatible versions into one catalog.

```sh
python3 scripts/content.py diff ./old/event ./new/event --pack ./common --before-pack ./old/rules --after-pack ./new/rules --godot /path/to/godot
```

Differences use escaped JSON pointers, preserve array order and cap output at 256
changes with an explicit truncation flag. Numerically equal JSON numbers such as
`1` and `1.0` are equal; a Boolean is never equal to a number, including in nested
lists or objects. The comparison is of resolved definitions, not source locations.

## Write safety and failure behavior

Cloning acquires its cooperative lock before inspecting content, captures the
manifest before validation, and checks it again before writing and publication.
A changed manifest is not overwritten; a failed manifest publication rolls back
the definition created by this attempt. A failed lock acquisition never removes
another author's lock. This is not an OS-level compare-and-swap protocol against
noncooperating writers or a guarantee of crash recovery.

Resolved exports are encoded fully, written and flushed to a same-directory
temporary, then atomically published without replacing any existing file. A
write, flush or exclusive-publication failure removes that temporary and leaves
the destination absent or unchanged. Filesystems that do not support hard links
return an error rather than falling back to an overwriting rename. This export
is an inspection snapshot, not an installable pack or game save.

`schemas --check` never creates output directories or rewrites schemas. Bare
Godot command names are resolved through PATH. A malformed result envelope,
engine error or exit-status disagreement cannot be reported as validation success.
