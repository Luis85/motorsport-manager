# Business process implementation — 2026-10-07

> Historical, source-bound implementation and verification record. This is not a complete browser/native gate pass or evidence for later source changes.

## Source and review target

- Base: PR #40, `feature/wildlands-engine-games`, commit
  `67cf508bf455dfa97be4ce62a1c3d72720f1f10a`.
- Local branch: `feature/business-process-simulation`.
- Verified implementation: `ee399d5de85dc69b2c424514e387f1d10047216b`.
- Wildlands verification source SHA-256:
  `291a4692a982317666771603d5f1b5f9b62f376517a80a8f28891ddb1f20da4b`.
- The first implementation commit defines the versioned process contract; later
  commits implement it and regenerate the distributables.

The change adds JSON process admission, deterministic ECS work scheduling,
guarded incremental agent edits, Scene Forge scaffolding and asset attachment,
2D/3D step scenes, bounded reports, and offline HTML import/export. The synthetic
agency project includes 12 editable Scene Forge scenes with compiled assets.

[Contract](../../reference/business-process-engine.md) ·
[Agent workflow](../../how-to/business-process-authoring.md) ·
[Offline agency demo](../../../demos/agency-delivery.html)

## Executed evidence

- Strict TypeScript preflight passed.
- The 76 registered Node suites produced 1,463 named passing assertions across
  the main run and one isolated rerun. All 24 new process checks passed.
- The aggregate `verify:node -- --keep-going` run remains **failed**: its CLI
  suite passed 17/18 because direct execution of the generated CLI returned
  `EACCES`. The generated file had mode 0644. After restoring its executable bit,
  that same suite passed 18/18. No assertion was removed or weakened. This is
  combined per-suite evidence, not a clean aggregate gate pass.
- Fixed a discovered parallel-test collision by moving the existing runtime
  closure fixture from the authored project tree into per-suite temporary space.
- `build:cli`, `build:demos`, `check:cli`, and `check:demos` passed. The bundle smoke
  builds all four templates without `node_modules`, including process commands.
- All 12 agency Scene Forge exports compiled; project validation passed.
- `check_docs.py` and `check_architecture.py` passed. Python tests: 340 run,
  321 passed and 19 skipped.
- Impeccable's static detector returned no findings. Its source reviewer scored
  all four requested fixes resolved: focus retention, persistent WebGL fallback
  explanation, accurate assumption copy, and viewport camera fitting. The
  documenter found no required changes to the incumbent design system.
- The agency run completed 6/6 cases at minute 189, with 3 rework visits,
  simulated cost 1,536 and mean cycle time 127.5 minutes. Inputs are synthetic
  assumptions, not measured business performance.

## Unavailable evidence and publication

Browser launch was denied by local socket restrictions, and escalation was
automatically rejected. Eleven dedicated browser checks plus a published-demo
check are registered but were not executed locally. No screenshots or visual
approval are claimed. The full 105-suite, 1,903-check gate remains outstanding.
Native Godot execution was unavailable. Advisory quality analysis was incomplete
because ruff, ruff-format, gdlint, gdformat and gdradon were unavailable.

Automatic approval review rejected the GitHub push because explicit publication
authorization was missing for the large repository change. No push or draft PR
was completed. The proposed publication is this branch as a draft PR targeting
`feature/wildlands-engine-games`, stacked on #40.

## Distributable identity

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `bin/wildlands` | 12,164,476 | `2f5d4e8b576c669a75b6dcef205dd2bad2e607a88fdb5f5e1af6cbe3f09d8fae` |
| `demos/agency-delivery.html` | 1,109,637 | `c48bc3c391b66b7f53a6269ea73945e0d89c20c92130dfdc1d93e12275e7879c` |
