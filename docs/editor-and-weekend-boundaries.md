# Editor ownership and explicit weekend entry

## Scope

This continuation is stacked on PR #18. It retains the five driver actions and
existing physical practice, qualifying, formation and race rules. It adds no
vehicle/driver modifier and makes no physics calibration claim.

## Track editor

`TrackEditorSession` owns the canonical authoring document, revision, saved
signature and bounded 50-transaction undo/redo history. A canvas gesture edits a
copy. Commit validates and copies that value; cancel returns the canonical copy
without destroying the redo branch. Rejected edits and failed replacements leave
existing work intact. Saving through a `TrackEditorPort` marks the document saved
only after the adapter reports success. Failed writes retain the edited work.

`LocalTrackEditorPort` is the filesystem adapter. Import, reference-image loading,
authoring export and runtime export no longer call filesystem APIs from the
editor view. Exports validate again when executed; validation at dialog opening
is not considered authorization for a later, changed draft.

Geometry compilation and diagnostics are application operations. The editor and
canvas receive a compiler collaborator, not ownership of a live race. The
reference-lap preview has its own `TrackReferencePreview`; it is explicitly a
reference-speed demonstration, not a second tyre/race simulator. The Godot-facing
application supplies preview elapsed time. Canvas refresh only reads its values.
Running-race track snapshots remain detached from all editor changes.

The native drawing UI still owns selection, pointer gestures and temporary
trace strokes. Those are presentation drafts, not authoritative race state. The
editor uses existing pure `TrackEdit` geometry operations while an application
session owns accepting their final document. This is not an editor tool expansion.

## Player journey

The minimal route is:

**Main menu → Grand Prix configuration → Welcome → Start practice → Practice
results → Qualifying → Qualifying results → Formation → Grid approval → Race →
Review weekend → Final classification → Main menu or New weekend.**

Configuration and welcome stage a detached `WeekendLaunch`. Neither replaces the
current simulation nor writes a checkpoint. Back preserves circuit/configuration
choices. Starting a new weekend requires confirmation when a live or disk-only
continuation exists; Cancel preserves both. A revision-bound commit prevents an
old or double-activated welcome from creating another event.

`WeekendEntryStore` is the application persistence port. The local adapter writes
the actual initial practice record before the application installs its new
simulation. A failed write leaves the old weekend installed and the new entry
retryable. The same staged entry reproduces the same initial practice state.

The welcome does not send a driver out. The existing pitwall commands and explicit
session approvals still drive physical runs, returns, formation, lights and racing.
At the finish, Review weekend opens `WeekendEndView` only after saving results.
`WeekendSummary` supplies detached, factual classification and the two managed
cars' actual status, completed laps, stops and best lap. No inferred component
failure, prize payment or causal attribution is fabricated. Final-track review
returns to the existing read-only terminal race state; New weekend stages again.

Legacy Engineering/Director diagnostic entry routes remain compatibility paths;
this document does not claim their entire controller API has been migrated.

## Verification contracts

The normal registry retains every previous required suite and adds editor-session,
weekend-launch and native entry/end tests. The existing complete physical-weekend
test now follows the real finish into the new end screen and back to the menu.

Checks cover nested-draft rejection, copy isolation, cancellation and redo,
bounded history, failed-save retention, detached compilation, invalid preview
time, stale/double entry commits, failed entry persistence, disk-only replacement
approval, native cancel/back/confirm and independent driver commands. Native
welcome/end profiles cover 1440×900 and 1100×720 at 100%, 115% and 130% text.
Synthetic results used for layout are explicitly separate from physical finishing
evidence. Exact results belong to the source-pinned verification report.

## Remaining larger-refactor work

The original typed-car entity migration and complete legacy controller-facade
migration are not delivered by these editor/entry changes. Authoritative records
remain validated serialized dictionaries; their units and save schema are
unchanged. Architecture checks are executable fitness rules, not a full GDScript
parser or a claim that arbitrary reflection cannot bypass a boundary. Platform
exports, physical controllers and screen-reader tests remain separate acceptance.
