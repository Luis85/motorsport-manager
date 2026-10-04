# Track editor and weekend-flow contracts — 0.19.0

The foundation completed in merged PR #19 retains the five driver actions and
existing physical practice, qualifying, formation and racing rules. It adds no
vehicle/driver modifier and makes no physics calibration claim.

## Track editor ownership

`TrackEditorSession` owns the canonical authoring document, read-only revision,
saved signature and bounded 50-transaction undo/redo history. A canvas gesture
edits a copy. Commit validates its observed revision and accepts another copy.
Cancel returns canonical data without destroying the redo branch. Undo, redo,
save and replacement invalidate older drafts; an old gesture cannot commit by
substituting the current revision. Rejected changes preserve canonical state.

The pure `TrackDocument` contract owns `draft_errors` and delegates its bounded
serialized-value traversal to the shared `RaceStateValue.serializable` policy.
`publication_errors` checks a safe editable draft before the complete circuit
rules used for save/export. The application session owns when
those policies run and when state can commit; it no longer embeds a parallel
copy of document rules. An open/short/unnamed draft is legal editing state, not a
publishable circuit. Legacy positional-node imports keep their validated
normalization path. Validation never mutates the caller's draft.

Saving goes through `TrackEditorPort`. The session marks a document saved only
after the adapter reports success. A failed write retains the edited document
for retry. `LocalTrackEditorPort` owns filesystem and reference-image operations;
views do not call file APIs. Runtime and authoring exports revalidate on execution,
not only when their dialogs opened. Import failures preserve existing work.

Beneath the application port, `Storage.FileOperations` permits deterministic
read/write/replace/rollback failures without adding filesystem calls to views.
`Storage.read_json` decodes structure; `TrackDocument` still accepts domain data.
The replacement policy restores only an original moved by that write attempt.
Failed rollback reports the preserved backup path; it never silently substitutes
a stale backup for a destination that did not exist. The storage contract suite
checks editor work, saved signature, revision and redo retention through these
actual policy failures, then retries using the retained draft.

Geometry compilation and diagnostics are application operations. Views receive
an injected compiler. The reference-lap preview is a reference-speed demonstration,
not a second tyre/race simulation. The application owns `TrackReferencePreview`;
canvas gets `TrackPreviewHandle` with toggle, stop and copied readouts, no clock.
The app supplies elapsed time. Race track snapshots stay independent of edits.

Selection, pointer positions and temporary trace strokes remain presentation
state. Pure `TrackEdit` geometry operations may transform a draft; only the
application session accepts it into the canonical document.

## Player journey

**Main menu → Grand Prix configuration → Welcome → Start practice → Practice
results → Qualifying → Qualifying results → Formation → Grid approval → Race →
Review weekend → Final classification → Main menu or New weekend.**

Configuration and welcome stage a detached `WeekendLaunch`. They neither replace
the current simulation nor write a checkpoint. Back preserves chosen options.
Starting a new weekend asks for confirmation when a live or disk-only continuation
exists; Cancel preserves both. The launch revision prevents stale/double starts.

`WeekendEntryStore` is the persistence port. Initial practice is saved before the
application installs the new simulation. A failed write retains the old weekend
and leaves the new entry retryable. Retrying the same entry does not reroll it.
Welcome does not send either driver out; the player still selects a driver and
uses the existing pitwall action. There is no new automatic command or resource.

Session approvals remain explicit. Closing practice or qualifying lets valid
started laps finish and waits for physical returns. Formation and lights remain
physical simulation phases. At the finish, Review weekend saves before opening
`WeekendEndView`. `WeekendSummary` returns copied classification plus actual
managed-car status, completed laps, stops and best lap. It does not invent prize
payments, component diagnoses or causal credit for a result.

Final-track review returns to the same terminal race state. New weekend stages a
new configuration rather than silently starting another race. The main menu's
Continue restores the actual saved event.

## Verification

The registry includes headless editor-session and launch contracts, native entry
and end-screen interaction, and a complete physical weekend leading into final
classification and back to the menu. Cases include stale gestures, copy isolation,
cancel/redo, bounded history, failed writes, invalid preview time, duplicate entry,
disk-only replacement confirmation, independent drivers and teardown.

Native welcome/end layout cases cover 1440×900 and 1100×720 at 100%, 115% and 130%
text. Synthetic result layouts are not physical finishing evidence. The complete
weekend tests provide the latter. Exact results belong to the source-pinned run.

See [Architecture](architecture.md) and
[Developing systems](../how-to/developing-mechanics.md) for the shared rules. Typed entrants,
detached diagnostic UI and scheduler-free view handles now apply across race,
replay and editor paths. This is not a new editor toolset or a claim of exhaustive
platform, controller or screen-reader acceptance.
