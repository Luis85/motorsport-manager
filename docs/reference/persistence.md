# Persistence and local data

Application services own persistence; widgets submit intent and show detached
status. Saves retain the content and rules selected at construction. Editing
`config/` or an external pack affects new selections rather than existing careers
or weekends. See [content compatibility](content/version-compatibility.md).

## Files and slots

Godot resolves `user://` to its application-data directory, shown in
**Settings → Local data**. Explicit exports use the native file-dialog destination.
The application does not save into packaged `res://config`.

| Path | Authority |
|---|---|
| `user://settings.json` | Applied presentation preferences, text scale, race interface, content roots and guide preferences |
| `user://tracks/*.json` | Saved editable circuit documents |
| `user://weekend.json` | Original weekend continuation, checkpoint and retained recording |
| `user://sandbox.json` | Independent experiment continuation |
| `user://weekend-results.json` | Bounded standalone factual results and once-only receipts |
| `user://circuit-notebook.json` | Opt-in observed history and revision-checked personal notes |
| `user://campaign.json` | Complete campaign checkpoint and active-weekend manifest |
| `*.bak` | Previous destination retained during recoverable replacement |

One original weekend and one sandbox slot are supported. Export important
histories before replacing a slot. Unapplied setup, editor and author-form drafts
are not a persistent recovery system. A running race owns its copied circuit;
subsequent library edits cannot change that geometry.

## Independent version contracts

The application release number in `project.godot` is independent of these formats.

| Contract | Version and interpretation |
|---|---|
| Editable track | Native authoring v1; [track format](track-format.md) describes optional metadata and baked runtime v2 |
| Race checkpoint | New performance-profile weekends use v12; supported earlier saves retain explicit migration/model semantics |
| Replay/session | Envelope v1; the embedded checkpoint determines model compatibility |
| Replay model | v10: `race-weekend-0.12-v1`; v11: `race-weekend-0.15-duels-v1`; v12: `race-weekend-0.20-performance-v1` |
| Authored replay scenario | Scenario v1 with a validated brief v1 and frozen replay record |
| Standalone result/receipts | Factual result/receipt v1; isolated from campaign sporting and cash authority |
| Circuit notebook | Notebook v1; observations and interpretations remain separate |
| Campaign checkpoint | v6 with versioned competition, economy, personnel, operations, engineering and management projections |
| Campaign management | v2 freezes authored campaign/race-content closure; v1 uses explicit compatibility defaults |
| Folder content pack | `schema_version: 1`, `runtime_contract: 1`; separate from pack semantic version and save versions |

`RaceRecordFormat.model_for` selects the model from the checkpoint version.
Older recordings are not relabeled as current performance-profile histories.
Restoring a raw checkpoint begins a recording at the restored point; it cannot
reconstruct earlier commands. Browser-prototype storage is not imported.

Scenario goals observe final facts and award no money or points. Standalone receipt
acceptance rejects sandbox results and conflicting evidence for an accepted event.
Campaign settlement and explicit correction are separate transactions described in
[the campaign boundary](campaign/weekend-boundary.md) and
[the correction contract](campaign/result-corrections.md).

## Validation and recovery

`Storage` limits ordinary JSON reads/writes to **16,000,000 UTF-8 bytes**. A
recognized save/replay envelope uses full-precision saved-number decoding; content
and legacy authoring imports keep their own numerical contract. Domain validators
still check structure, finite bounds, identities, ownership, chronology and model
compatibility before replacing authority. Digests establish local consistency,
not authentication or proof of genuine play. See
[saved-number semantics](../explanation/persistence-numbers.md).

Writes serialize completely before filesystem mutation, create and flush a
temporary file, retain the old destination as `.bak`, then rename the candidate.
Failed replacement attempts rollback and reports surviving backup evidence when
recovery fails. Invalid primaries are reported rather than silently replaced from
backup. This is recoverable file replacement, not a database or disk-failure
guarantee. [Troubleshooting](../how-to/troubleshooting.md) describes manual recovery.

The race application observes phase changes for autosaves, including initial
practice, independently of panel visibility. Menu/exit save paths remain explicit
application lifecycle operations. A disk-restored active race opens paused.

Campaign transactions stage one complete checkpoint or no candidate. The native
shell persists campaign and weekend files separately; checkpoint atomicity does
not guarantee atomic replacement of both files together. If an active campaign's
weekend is missing or invalid, loading reports the problem instead of fabricating
a race or settlement. Preserve both files and their backups for recovery.

## Verification and earlier formats

The registered native suites cover migration, malformed inputs, numerical
continuation, sandbox isolation and storage failures; packaged smoke additionally
tests restart and interrupted-write recovery. Test processes use isolated user
data. Exact discrete/RNG state and declared numeric tolerances are tested;
cross-CPU bit-identical floating-point continuation is not promised.

See [verification](../how-to/verification.md), [standalone validation](../how-to/standalone-validation.md),
and [the historical persistence record](../_archive/releases/persistence-through-0.14.md)
for source-specific earlier migration details.
