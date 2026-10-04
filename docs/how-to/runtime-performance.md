# Shipping runtime measurements

## Reproduce the comparison

Use the pinned Godot 4.7.2 editor. Keep two frozen source directories, with the
same benchmark harness and registry in each, and put evidence outside both:

```sh
python3 scripts/paired_runtime.py \
  --baseline /path/to/baseline --candidate /path/to/candidate \
  --baseline-revision '<actual baseline commit plus disclosed harness changes>' \
  --candidate-revision '<actual candidate commit plus disclosed harness changes>' \
  --godot /path/to/Godot_v4.7.2-stable_linux.x86_64 \
  --pairs 3 --seconds 8 --output /path/to/paired-evidence
```

`paired-runtime.json` records both source-content digests, the exact engine
binary hash, harness hashes, execution order, complete individual reports and
summary medians. Individual directories also retain the ordinary verification
runner's import, script-load, architecture and runtime logs. The wrapper refuses
nonempty output, different harness bytes, changing source, failed checks,
incomparable hardware/fixtures, or different controlled sporting outcomes.

The harness is `tests/shipping_runtime_tests.gd`, with the shared physical
weekend journey and `tests/support/runtime_probe.gd`. Disclose any harness or
source changes in the revision labels; a modified tree is not an unchanged commit.

## Work and boundaries

The test starts Pinecrest Motor Park with seed 7314, dry/calm conditions, twelve
cars and a 24-lap race. Both managed drivers physically complete practice and
qualifying; formation and the lights also run through ordinary application
commands and fixed steps. No final classification or phase is assigned to make
the benchmark reach a convenient state. The prepared sporting-state hash and
step count must match across compared runs.

Microbenchmarks use four warm-up calls and 24 measured calls, except expensive
persistence (12) and editor compilation/inspector work (8). Reports retain raw
microseconds, medians, p95 and maxima. Native timing-control updates are measured
separately from the application query and full minimal-workspace refresh.
Serialization, replay sealing, already-sealed filesystem writes and complete
session saves are distinct measurements, not interchangeable labels.

Simulation-only work executes exactly 1,000 fixed steps / 50 simulated seconds.
Controlled-frame experiments supply the same 120 frame intervals at 1× and 16×
with different observation schedules; steps, complete outcomes and clock
clamping must agree. These deterministic experiments do not establish real-time
playback speed.

Each native paused/1×/16× sample warms up for two wall seconds, then runs the
requested measured window using the ordinary application process loop, minimal
controls and canvas renderer. Reports record delivered simulation time, actual
wall time, frame-interval samples, scheduler/query/visual CPU time and calls,
row updates, draw calls and clock input. The 120 FPS limiter is a ceiling, not an
achieved frame rate. V-sync is requested off and the engine-reported mode is
recorded separately; the software driver may warn that changing it is unsupported.

The editor workload adds a declared 120 scenery objects and measures full and
preview compilation, pure document moves, inspector refresh, and native pan
frames. Canonical state/history must remain unchanged. Frame intervals include
rendering, waiting and OS scheduling, not isolated GPU time. Godot retained static
bytes are disclosed as retained bytes, not a count of allocations or OS memory.
Test-only custom performance monitors are removed after measurement.

## Attribute the measured work

Separate query, UI refresh, simulation, record preparation, sealing and filesystem
costs. A quicker subroutine does not establish a faster complete save or live race.
Use the same physical fixture and compare sporting outcomes before crediting an
optimization. Advanced tools are optional player interfaces; their advisory query
work is distinct from the Minimal capture path.

## Evidence interpretation

Use paired results from one host and renderer. Do not compare these local
software-renderer numbers against earlier hosted medians as though they were a
controlled experiment. Three pairs describe these workloads; they are not a
statistical confidence interval, a player-hardware survey or a frame-rate promise.

Requested speed and actual delivered simulation time must be reported together.
A shortfall can occur before `RaceStepClock` receives a delta: compare wall time
with native-supplied active seconds instead of blaming the application's clamp
without evidence. A faster save-preparation component does not establish faster
race simulation, faster rendering, a faster whole save, or sustained 16× playback.

For the dated traversal experiment and its exact source digests, see the
[28 September 2026 record](../_archive/verification/runtime-performance-2026-09-28.md).
