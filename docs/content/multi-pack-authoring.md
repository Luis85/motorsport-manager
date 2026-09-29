# Multi-pack authoring and safe file output

The Python companion sends content to the production Godot compiler. It does not
implement a second schema, resolver, or simulation. Commands can select several
folder packs without changing or rebuilding the game.

## Ordered selection

`validate`, `inspect`, `list`, `export`, and `test` accept repeated `--pack PATH`.
An optional positional pack is loaded first, then the repeated packs in command
order. The bundled core is always loaded once. Canonical duplicate paths are
ignored, including spelling a directory with `.` or using the core directory
explicitly. Different directories declaring the same pack identity still fail.
Dependencies must precede their dependants; the compiler reports a missing or
wrong-version dependency rather than silently reordering conflicting overrides.
Paths containing spaces or Unicode are supported when quoted by the shell.

```sh
python3 scripts/content.py validate --pack './my base' --pack './my season' \
  --godot /path/to/godot --format json
python3 scripts/content.py inspect --pack './my base' --pack './my season' \
  --id local.season.weekend.opening --godot /path/to/godot
python3 scripts/content.py list --pack './my base' --pack './my season' \
  --kind weekend --godot /path/to/godot
python3 scripts/content.py export --pack './my base' --pack './my season' \
  --output ./resolved.json --godot /path/to/godot
python3 scripts/content.py test --pack './my base' --pack './my season' \
  --scenario local.season.scenario.opening --steps 1600 --godot /path/to/godot
```

The export is an inspection snapshot with resolved definitions and provenance,
not a folder pack. It never overwrites an existing destination. A failed schema
or dependency check never creates the output. A simulation test runs actual fixed
steps; neither a successful dry read nor an export proves that a race finished.

## Clone across packs

`clone --pack PATH` still identifies the writable destination. Repeat
`--include-pack PATH` for source and dependency packs, in dependency order before
the destination. Only the destination manifest and new definition are written.
The destination manifest must already declare any dependencies it requires.

```sh
python3 scripts/content.py clone local.base.vehicle.gt \
  --as local.season.vehicle.gt --pack './my season' \
  --include-pack './my base' --godot /path/to/godot
```

Circuit clones receive a new track-document identity as well as a new definition
identity. Duplicate IDs, foreign namespaces, symbolic-link destination directories,
and existing definition files are rejected. Edit the cloned definition, then
validate the full selection again.

## Compare two content sets

For `diff`, repeated `--pack` options are common dependencies loaded **before**
each positional side. `--before-pack` and `--after-pack` append side-specific
packs after their corresponding positional pack. This lets a season be compared
with another version while each resolves against the same base content.

```sh
python3 scripts/content.py diff './season before' './season after' \
  --pack './my base' --before-pack './old overrides' \
  --after-pack './new overrides' --godot /path/to/godot
```

Differences use escaped JSON Pointer paths and preserve array order. Booleans are
not numbers (`true` differs from `1`), but numerically equal JSON numbers such as
`1` and `1.0` compare equal. Output is bounded to 256 differences with an explicit
`truncated` flag. Source-root changes alone are not gameplay changes.

## Failure handling

An engine result must be a single JSON object with a Boolean `ok` field and an
agreeing exit code. Import errors, script errors, extra result envelopes,
non-finite JSON numbers, and malformed result envelopes fail closed. Diagnostic
text embedded in an authored label is data, not an engine log. `--godot godot`
resolves the executable on `PATH`; explicit paths and `GODOT_BINARY` remain valid.

New-file writes serialize before exclusive creation, flush and synchronize the
file, close handles before cleanup, and remove an owned partial file after a
normal write failure. Cleanup never deletes a different writer's replacement.
Filesystem failures that also prevent cleanup are reported as failures; this is
not a cross-process transaction service or a power-loss durability guarantee.
Clone's manifest replacement uses its existing exclusive author lock and an
atomic replace. Failed initialization removes only its newly created empty pack
directory, never parent directories or existing content. `schemas --check` is
read-only even when the schema output directory does not exist.

## Verification

`test_content_hardening.py` covers selection, protocol and I/O failures.
`test_content_multipack.py` loads real packs with the pinned engine, exercises
validation, inspection, listing, export, diff and cross-pack cloning, and rejects
missing/out-of-order dependencies. Set `GODOT_BINARY` or
`VERIFICATION_TEST_GODOT` to run those native integration tests. Without an engine,
they are explicitly skipped, not reported as executed validation.
