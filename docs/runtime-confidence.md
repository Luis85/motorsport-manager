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

## Completion boundary

The iteration remains open until sequence/lifecycle coverage, the two selected
responsibility reductions, paired shipping runtime measurements and standalone
export/recovery journeys have evidence. The full registered regression gate,
24 unchanged sporting checkpoints and native layout/physical journeys remain
mandatory. A focused reproduction pass does not substitute for that acceptance.
Windows build success must be distinguished from execution on Windows.
