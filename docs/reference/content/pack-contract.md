# Content pack contract

## Catalog sources and schemas

The built-in `core` pack lives in `config/`. Its manifest and family JSON files,
bundled circuits in `config/circuits/` and diagnostic collections in
`config/scenarios/` hold the authoritative shipped values. External examples and
generated schemas live in `content/`. Diagnostic collections are bounded bundled
verification resources; they are separate from external complete-weekend scenario
briefs.

`ContentSchema` is the executable schema contract. The checked-in JSON Schemas
are its generated projection, rather than a separately maintained validator.
The content CLI's `schemas --check` command checks that projection without writing:

```sh
python3 scripts/content.py schemas --check --godot /path/to/pinned/godot
```

External packs contain inert JSON definitions and an explicit `pack.json` file
list. They cannot load scripts, add algorithms or relax code-owned validation and
resource limits. Built-in circuits reuse their original track documents; the
trusted core adapter does not introduce a second circuit format.

## Selection, identity and provenance

Launch the exported game with `-- --content-pack=/absolute/path/to/pack`, or
provide an array of explicit pack-folder paths through `content_roots` in
`user://settings.json`. Keep each pack's manifest and relative files together.
For ordered dependencies and CLI examples, see
[multi-pack authoring](../../how-to/content/multi-pack-authoring.md).

Stable dotted IDs identify definitions. Display names and filenames do not grant
ownership. Core loads first, and dependencies must declare an exact pack version
and appear before their dependants. Manifest order is deterministic; arrays retain
their authored order for hashing. A duplicate definition requires an explicit
whole-record override with the prior resolved SHA-256. `inspect` reports the
resolved definition, hash and source chain.

## Strict decoding and bounded input

The loader rejects comments, trailing commas, duplicate keys, non-finite numbers,
wrong scalar types and unknown fields. UTF-8 is checked before JSON decoding.
Pack file paths cannot escape the selected root or traverse symbolic links.

| Limit | Maximum |
|---|---:|
| Selected packs | 32 |
| Files | 2,048 |
| Bytes per file | 1 MiB |
| Total bytes | 16 MiB |
| Nested levels | 24 |

The numeric parser also bounds token length and exponents. Definition schemas
and domain validation impose tighter per-family and cross-field limits. Content
cannot change these parser or safety limits. An invalid reload retains the last
valid catalog.

## Frozen runtime and continuation

Compilation produces validated, frozen definitions. A new weekend retains its
selected vehicle, roster, tyres, setup, race tuning, mechanic profile and effective
weekend record. Circuit/style snapshots and scenario context retain their
corresponding identities. Save restoration and replay read the retained records,
not edited source files.

A new Team Principal career freezes its resolved campaign definition and the
referenced calendar circuits and race-content closure at creation. Departure and
settlement use that frozen closure. Editing, overriding or removing a source pack
therefore affects later sessions and careers, rather than retuning an existing
save. Old saves and direct legacy APIs retain explicit compatibility adapters.
See [version compatibility](version-compatibility.md) for omission and migration
rules and [persisted numeric identity](../../explanation/persistence-numbers.md) for exact decoding.

## Authoring acceptance

The content CLI uses the production Godot compiler for native validation. `init`
is an offline folder-creation operation; it reports `engine_executed: false`.
Missing engines and failed imports cannot establish native acceptance. Use
`--format json` where supported to inspect `ok` and `engine_executed`.

Cloning refuses overwrites, acquires a cooperative writer lock and rolls back
its newly created definition if manifest replacement fails. Resolved exports are
inspection snapshots, not installable packs or game saves. The precise write and
failure contract belongs to [multi-pack authoring](../../how-to/content/multi-pack-authoring.md).

Validation establishes schema and domain acceptance. A bounded CLI scenario run
establishes only the simulation steps it actually executed. Neither establishes
competitive balance, completion of a whole weekend or human usability. Current
release evidence belongs to [current project status](../current-state.md) and the
[verification guide](../../how-to/verification.md).
