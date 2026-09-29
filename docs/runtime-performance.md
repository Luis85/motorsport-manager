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
weekend journey and `tests/support/runtime_probe.gd`. To compare the traversal
change in isolation, copy the same candidate source to the baseline directory
and restore only `RaceRecord.integer_paths` and its private helper to their
pre-optimization implementation. Disclose this setup; a working tree is not an
unchanged upstream commit merely because its revision label names that commit.

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

## Selected change and scope of the conclusion

The measured persistence path repeatedly builds integer-type paths before
sealing a replay/save. The old traversal allocated an intermediate result array
for each visited value and another path array for each child. The candidate uses
one traversal stack, copying only retained integer paths. It introduces neither
cache invalidation nor a live-state observation shortcut.

`record_traversal_tests` checks the exact former algorithm as a test oracle over
three independent generator seeds and nested values. It preserves path order,
caller prefixes, detached returned paths, numeric meaning, ordinary replay
validation, JSON round trips, restoration and gameplay RNG. This is not a replay
format migration or a second authoritative record.

The known `RaceViewQuery` supplied-record advisory round trip is also sampled,
but it is not part of the shipping minimal capture path. Its API continues to
evaluate the supplied record; it has not silently changed into a current-live-car
query. One advisory call does not attribute the full cost of an old diagnostic
strategy/debrief refresh. Those panels remain outside player navigation.

The primary implementation references are Godot's optimization guidance and
custom-monitor facilities:

- https://docs.godotengine.org/en/stable/tutorials/performance/general_optimization.html
- https://docs.godotengine.org/en/stable/tutorials/scripting/debug/custom_performance_monitors.html

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

## Recorded local experiment — 28 September 2026

Three alternating baseline/candidate pairs completed, with all six benchmark
runs passing 73 checks each. Host: AMD EPYC 9V74; Linux OpenGL compatibility,
llvmpipe (LLVM 19.1.7, 256 bits), 1440 × 900, 100% text, LP_NUM_THREADS=2.
Each native state had two seconds of warm-up and eight measured wall seconds.
The twelve-car fixture reached the same prepared state after 10,411 fixed steps,
with 77 strategy journal records. This is software-renderer evidence, not a
representative consumer-GPU measurement.

| Workload | Baseline median | Candidate median | Observation |
|---|---:|---:|---|
| Minimal query | 0.309 ms | 0.291 ms | Small; no optimization claim |
| Native timing controls | 0.017 ms | 0.017 ms | Unchanged |
| Full minimal refresh | 0.430 ms | 0.454 ms | No improvement claimed |
| Integer-path preparation | 18.428 ms | 10.637 ms | 42.3% lower |
| Replay sealing | 158.020 ms | 147.195 ms | 6.9% lower |
| Already-sealed write | 41.345 ms | 41.038 ms | No meaningful gain claimed |
| Complete session save | 201.608 ms | 202.728 ms | No end-to-end improvement established |

These are medians of the three per-run medians. Integer-path preparation was
lower in every pair (18.428/18.684/16.574 ms versus 9.889/10.843/10.637 ms).
Replay sealing was also lower in each pair. Whole-save differences changed
sign; reporting this as a faster complete save would overstate the evidence.
Unchanged workloads also vary, so their differences are not credited to the
traversal change.

Decision: retain the small, tested traversal change for its repeatable component
and sealing improvements. Do not add a cache or claim improved rendering,
simulation throughput or whole-save latency. The larger remaining costs still
need their own attribution before another optimization is justified.

In the candidate's three native samples, requested 1× delivered 1.002×, 0.997×
and 1.004×. Requested 16× delivered 6.379×, 7.351× and 7.323×, with p95 frame
intervals 373.758, 318.908 and 326.314 ms. The engine supplied less active delta
than elapsed wall time; the application clock reported zero discarded delta in
these native samples. The separate controlled experiment deliberately exercised
its frame cap and retained identical 214/3,424 steps at 1×/16× across sources.
No sustained-16× or frame-rate guarantee follows from this experiment.

Frozen source identities (both based on `17a9651eb9a963b25ba294c890751033d4178881`
plus the disclosed identical benchmark/tests, differing only in the traversal):

- Baseline source digest: `7779cce68a8b4609be52cba5ed9da0b4c70a120ac005fb11f5ee2c10b5bd5e15`.
- Candidate source digest: `54efba887c61eb8423cb937439a3bfc93793ac69c46ae1ed4c7022369bb5aaf9`.
- Engine binary SHA-256: `8d106cbe6144c2dc7e881d61d2429c1a8a76e6b22ef48bd5e48dcf934953f71e`.
- Raw `paired-runtime.json` SHA-256: `875f56e1881cdd20ed7e350ccc9a4d53eb6105f3dae3721fbb890cd19004e8ec`.

The handoff's raw evidence and reconstruction patches retain these exact sources.
Later documentation/CI edits are not retrospectively part of this timed snapshot;
final regression and packaged acceptance identify the published revision separately.
