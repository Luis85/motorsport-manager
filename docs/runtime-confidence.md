# Runtime confidence and change safety

Baseline: merged PR #22, `def854b699a17632ff48d58bb49182b22e2477c9`.
The typed entrants, mechanic profiles, application/presentation boundaries and
editor session are completed foundations. This iteration does not reopen them.

## Developer reproduction (increment 1)

`RaceReproduction` is an **opt-in developer observer**, never installed by the
shipping composition. Attach it *after* the existing `RaceRecord`, supplying the
source commit (and disclosing dirty working-tree changes). On rejected input,
call `note_attempt` with the actual return value and rejection message. On an
invariant failure, `seal` wraps the existing, unchanged replay record together
with the failure evidence. The authoritative record still contains the frozen
track, initial checkpoint, seed, engine/model, accepted commands and step count.
The mechanic description belongs to the diagnostic wrapper, not the save.

The sidecar retains at most 64 state boundaries / 6,000,000 serialized state bytes
and 64 input-attempt descriptions. Oversized or non-serializable rejected payloads
are explicitly omitted. Dropped evidence counts are always retained. A record
which has already reached its own continuity limit remains incomplete: the
sidecar cannot reconstruct missing accepted input or invent a replacement engine.
This detailed capture is intentionally expensive and **not a production profiler**.

```gdscript
var trace = RaceReproduction.new()
trace.attach(existing_record, "<actual source revision; disclose dirty changes>")
# After an actual command:
trace.note_attempt(action, payload, accepted, commands.last_error)
# On a failed invariant, write through an application/storage adapter:
var bundle = trace.seal({"invariant": "<observed violation>", "evidence": actual_values})
# Explicitly remove both signal connections when leaving the developer session.
trace.detach()
```

```sh
python3 scripts/verify.py --godot /path/to/pinned/godot --suite reproduction_tests
python3 scripts/reproduce.py reports/reproduction_tests/reproduction-defect.json \
  --godot /path/to/pinned/godot --output reports/reproduced-defect.json
```

The second command exits **1** for the deliberately failing test fixture, **0**
for equivalent retained boundaries and a verified endpoint, and **2** for launcher
or file errors. The existing `RaceReplay` executes the record in a clean temporary
project with separate user data; a second replay engine is not implemented.

The diagnostic names the first differing **retained** step/input boundary, field,
recorded value, replayed value and last accepted input. Expected means *recorded
run*, not a claim that the recorded run was correct. The last input is context,
not an inferred cause. Missing values differ from recorded null values. Numeric
comparison uses the existing replay tolerance. Earlier discarded boundaries
cannot be diagnosed retrospectively; their count is disclosed.

`reproduction_tests` deliberately introduces an unjournaled fuel mutation via a
test-only signal callback. The ordinary replay has no such mutation. The suite
asserts the first actual divergence at fixed step 5, `cars[3].fuel`, then serializes
and reloads the evidence. The Runtime confidence workflow invokes the same bundle
in a second isolated process. Neither the defect nor the sidecar is active in the
shipping game, and this fixture does not replace any pinned sporting checkpoint.
The workflow retains the exact engine archive, origin, SHA-256, license and source
revision so the developer's reproduction toolchain is identifiable.

## Interaction sequences and focused responsibilities

The registered `operation_sequence_tests` uses its own deterministic generator,
never the race RNG. Its saved recipes can be replayed with `--sequence=<path>`.
The three default seeds compare different observation and restoration schedules,
exercise deliberately rejected input and editor save failures/retries, and retain
failure recipes without changing the pinned regression fixtures. A separate
explicit sequence reaches practice results, qualifying, qualifying results and
formation; short random recipes alone are not evidence of a completed weekend.

Base commands now delegate session progression, driver-mode changes and pit
operations to named aggregate-owned methods. `command_responsibility_tests` is
registered alongside the unchanged complete suite, not merely present on disk.
Command legality, recording, validation order and mechanic predecessor behavior
remain under the aggregate; there is no second command dispatcher.

`TrackCanvasInput` interprets pointer events; `TrackCanvasGesture` owns the
current disposable draft identity, frozen selection and revision captured at
pointer-down. Exact position/handle/reference transformations are pure `TrackEdit`
operations. Only `TrackEditorSession` commits canonical history. The native
`editor_gesture_tests` checks:

- One transaction for many motion events; no transaction for a selection click.
- Escape or target change cancels without deleting redo. Undo/redo and replacement
  invalidate outstanding pointer input, including replacement before first motion.
- Window focus loss retains the established commit-once behavior; a later release
  cannot commit again. A stale session revision rejects even without a UI refresh.
- Closing and reopening the editor releases its session despite retained weak
  preview handles; node/resource/orphan counts stabilize after warm-up.

Rendering and temporary input remain in presentation. Do not use simulated tick
as a document revision or resurrect stale gestures after restoring history. The
remaining large rendering/orchestration modules are not arbitrarily partitioned
just to satisfy the advisory line count.

## Completion boundary

The iteration remains open until the two selected responsibility reductions,
repeated weekend lifecycle coverage, paired shipping runtime measurements and
standalone export/recovery journeys have evidence. The full registered regression
gate, 24 unchanged sporting checkpoints and native layout/physical journeys remain
mandatory. Focused reproduction/sequence/gesture passes do not substitute for that
acceptance. Windows build success must be distinguished from execution on Windows.
