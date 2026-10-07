# ECS M6 verification results

## Milestone result

**Passed.** M6 completed the planned compatibility-preserving ECS architecture migration with versioned simulation profiles, a fixed compiled archetype contract, explicit scenario/save migrations, atomic profile activation, and data-only authoring boundaries.

## Release gate

| Measure | Result |
|---|---:|
| Total checks | **1,006 / 1,006** |
| Suites | **27 / 27** |
| Simulation-profile unit | **15 / 15** |
| Simulation-profile integration | **15 / 15** |
| Engine composition | **14 / 14** |
| Scenario schema and CLI | **47 / 47** |
| Release contracts | **58 / 58** |
| Browser | **89 / 89** |
| Browser contracts | **16 / 16** |

## Artifact identity

```text
littlewild.html
bytes:   3788823
sha256:  73a1d790ec3ca2c04f57ff4dab16c3c68184b871dd555a7b613c2809861be96c
```

## Proven migration boundaries

| Source input | Verified canonical result |
|---|---|
| Native state v8 | v8 state under captured `classic-v1` profile |
| Scenario pack schema 1 | Schema 2 with `classic-v1` and migration note |
| Scenario pack schema 2 | Schema 2 with validated embedded profile |
| Scenario context version 1 | Context version 2 with `classic-v1` and migration note |
| Scenario story envelope 9 | Envelope 10 after original-fingerprint validation and explicit migration |
| Scenario story envelope 10 | Envelope 10 with independent experience and simulation fingerprints |

## Architectural assertions

The verification gate establishes that:

- JSON can tune bounded actor/economy values and select the known `living-world-v1` archetype, but cannot add executable systems, handlers, callbacks, source code, or modules;
- every engine captures its profile at construction, so later catalog changes cannot alter an existing simulation;
- the profile and composition declarations are deeply immutable after validation;
- imported profiles are checked both structurally and against the compiled runtime order;
- profile, Base, Adventure, World, Growth, world-profile, and native-state activation is atomic and rolls back on failure;
- state format v8 and all supported legacy migrations remain compatible;
- Littlewild and Emberworks continue to use one compiled mechanics implementation;
- presentation, DOM, camera, device state, file I/O, and wall-clock time remain outside simulation inputs.

Machine-readable evidence is stored in `verification/v15/gate-results.json`, `source/simulation-profile-results.json`, `source/simulation-profile-integration-results.json`, and `source/v15-schema-results.json`.
