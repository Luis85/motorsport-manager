# Ordered multi-pack authoring

The Python CLI uses the production Godot content compiler for acceptance. Core is
always first. Repeat `--pack` in dependency order; an optional positional pack is
loaded last. No folder discovery, sorting or silent dependency downloading occurs.
Paths containing spaces or Unicode are supported when quoted by the shell.

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
The existing one-pack positional commands continue to work. A bounded scenario
test runs actual fixed steps; an export or a successful short segment is not proof
that a whole weekend finished or that the content is competitively balanced.

## Cloning across packs

`clone --pack` remains the writable destination, not an extra input. Use repeated
`--dependency` options to load its prerequisites. `--include-pack` is an alias for
that same option; both spellings preserve their command-line order. The source can
be any definition in the validated catalog, including a dependency's override.
The destination must use its own namespace and a previously unused definition ID.

```sh
python3 scripts/content.py clone local.vehicles.vehicle.gt --as local.event.vehicle.gt --pack ./event --dependency ./vehicles --dependency ./rules --godot /path/to/godot
```

Cloning does not copy transitive references into the destination, invent missing
dependencies, or change dependency versions. Declare the destination dependencies
before cloning. Cloned circuits receive a distinct internal document identity.
Symbolic-link destination directories and manifests are rejected. Edit the copied
definition, then validate its complete dependency selection again.

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

Other new-file writes also serialize before exclusive creation, synchronize the
file, and close handles before failure cleanup. Cleanup only removes an owned
partial file, not another writer's replacement. Failed initialization removes
only the new empty pack directory, never parents or existing content. Filesystem
errors preventing cleanup remain failures, not a success or durability claim.

`schemas --check` never creates output directories or rewrites schemas. Bare
Godot command names are resolved through PATH. An engine result must be exactly
one JSON object with an explicit Boolean `ok` and a matching exit status. Import
or script errors, malformed envelopes, non-finite values and floating overflow
are failures. Text such as `ERROR:` inside an authored label remains data, not
an engine diagnostic.

## Regression coverage

`test_content_multipack.py` retains the concurrent implementation's ordering,
transaction, protocol and native compiler tests. `test_content_multipack_smoke.py`
adds independent native read, export, diff and cross-pack clone paths with Unicode
locations and diagnostic-like labels. `test_content_hardening.py` covers strict
JSON results, initialization rollback and inode-aware cleanup. Set both
`GODOT_BINARY` and `VERIFICATION_TEST_GODOT` to the pinned engine when running the
whole Python suite. Without an engine the native tests explicitly skip; that is
not successful validation. CI supplies both variables for these authoring tests.
