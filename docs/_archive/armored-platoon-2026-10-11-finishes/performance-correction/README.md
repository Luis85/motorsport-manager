# Finish timeout diagnosis and bounded optimization

Historical verification record for baseline implementation `09ed672642aedee855d2d45f0e8c4a611127ca7b` and the subsequent uncommitted generator optimization. The optimized source identities are pinned in [source-identities.json](source-identities.json); this record does not invent a commit identity or claim a later complete CI pass.

The original Wildlands complete gate exceeded the unchanged 120-second `asset-finish` suite budget under concurrent CI load. Its earlier fast-tier execution in the same job passed 9/9 in approximately 79.45 seconds. A timeout is a failed gate, even when other attempted suites passed. Root retains the failed workflow logs separately.

## Diagnosis

The isolated original nine-check suite passed, with 77.216 seconds spent in timed check bodies. The 81-recipe native/engine pixel comparison took 15.140 seconds; the actual 255-finish material-owner budget check took 58.720 seconds. Neither assertion nor recipe count was reduced.

VM overhead was substantial. The independent nine-recipe native probe produced the same pixel digest in all four cases: normal CommonJS-equivalent execution took 58 ms, default `vm.runInNewContext` took 1,651 ms, an explicit host Math property took 1,072 ms, and a lexical Math binding took 284 ms. These are separate diagnostic substitutions, never changes to the registered harness. The runtime's original 81-recipe CommonJS execution took 352 ms; its slow default-VM result is not representative of normal production module cost. Measurements include startup/JIT effects and shared-host contention, so they are observations rather than controlled throughput benchmarks.

The production change precomputes each recipe's periodic Float64 noise fields, retains arithmetic interpolation order, captures Math functions from the current realm, and writes typed-array channels directly. It does not inject host intrinsics into a test realm or replace the VM test harness. The three 128×128 Float64 tables use **384 KiB of bounded temporary storage per generator call**, plus small lattice/index/interpolation tables; they are not a retained cache. This trades repeated computation and temporary closures/arrays for bounded per-call storage. No before/after peak-memory reduction is claimed.

## Preserved contract and observed result

All **81 recipes / 243 channel hashes** match the frozen original bytes. The aggregate color/normal/ORM digest remains `0e645858b3f3af227e367a64dee336d84cb41b47915edc35ae8ce6e41961d8c2`. The added native golden assertion pins this pre-optimization contract. The existing Wildlands suite is byte-unchanged: all nine named checks, malformed-data cases, cross-realm admission, real Three resources, all 255 finish allocations, failure cleanup and owner/disposal assertions remain.

The optimized isolated suite passed **9/9 in 2.029 seconds total process wall time**, within the same 120-second cutoff. Pixel parity took 0.790 seconds, the owner-budget case 0.684 seconds and constructor-failure cleanup 0.057 seconds. Process CPU time was 2.464 seconds, including worker/JIT threads, and maximum RSS was 204,344 KiB. The baseline's 77.216 seconds is a sum of check bodies, not an independently measured whole-process duration.

The unchanged default-VM native 81-recipe profile fell from 14,665 ms to 438 ms; the intermediate lattice/direct-write-only version took 4,278 ms and is retained. Final runtime 81-recipe execution took 243 ms in CommonJS and 264 ms in a default VM. Local headroom is substantial; normal CI concurrency and rebuilt artifact acceptance still require their own results.

## Evidence inventory

- [Harness comparison](harness/comparison-receipt.json), original/optimized per-check logs, realm probe and process counters.
- [Native receipt](native/receipt.json), full 81-recipe before/intermediate/final hashes, focused tests and complete Model Forge/Scene Forge logs. The 181/182 intermediate native result retains the expected stale-bundle failure; its 182/182 successor is distinct.
- [Runtime baseline](runtime/baseline81.json) contains every original channel digest; [final profile](runtime/final-runtime-profile.json) records all 243 comparisons for both module and VM execution.
- Source snapshots and diagnostic scripts are stored only as `.txt`/`.gz` review artifacts. They are not executable repository test sources. Raw receipts retain their original working paths; the archive manifest maps portable files and hashes.
- An initial optimized timing invocation could not launch because `/usr/bin/time` was unavailable. Its error is preserved. The actual successful run used Python monotonic timing, child CPU/RSS accounting and a 120-second subprocess timeout.

No tracked files or shared generated outputs were modified by this independent profiling task. These CPU observations do not measure browser frame rate, hardware GPU performance, long-session memory stability or reference fidelity.
