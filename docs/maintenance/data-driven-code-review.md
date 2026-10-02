# Comprehensive code review — data-driven campaign and refactoring closure

**Baseline:** `main` after merged PR #27 (`2863adcd71f2c161e47bc8879c46e1eb8e9a970a`)  
**Review branch:** `refactor/data-driven-campaign-polish`

## Review objective

Audit the native Godot project after the campaign-roadmap merge, with four explicit goals:

1. game content and numerical campaign tuning must be data-driven;
2. active careers must be insulated from later content-pack edits;
3. known maintainability/refactoring debt must be closed rather than documented indefinitely;
4. race/weekend authority, determinism, save compatibility and existing player controls must remain unchanged.

This review treats **data-driven** as authored content/tuning selected through validated records. Engine algorithms, schema versions, identity rules, safety/resource bounds and supported behavior vocabularies remain code-owned contracts. Moving executable rules into JSON would weaken the existing trust boundary and is deliberately not part of the target.

## Findings and resolutions

### CR-01 — Campaign starter was a second content system — closed

The race weekend already used strict JSON packs, schemas, stable references and frozen runtime definitions. The Team Principal campaign did not. `CampaignStarter` embedded career/organization/season IDs, 1950 start date, opening cash, reserve, scoring, calendar spacing, staff salaries, facilities, rival resources, event finance and race options.

**Resolution:** added the `campaign` content family and `core.campaign.team-principal`. The starter is now an interpreter of a validated `CampaignDefinition`; the core pack owns the actual starter data.

### CR-02 — Campaign weekend duplicated race configuration — closed

The campaign constructed a legacy-style race-options dictionary instead of referencing the same authored weekend contract used by standalone play.

**Resolution:** added `core.weekend.campaign-starter`. The campaign references that weekend by stable ID and freezes its resolved roster, tyres, setup, tuning, mechanic profile and vehicle definition through the ordinary race-content boundary.

### CR-03 — Content pack changes could affect a running career — closed

Reading the live catalog again on later rounds would make an installed content update capable of changing an existing career.

**Resolution:** `CampaignContentSnapshot` is stored inside `CampaignManagement` v2. It freezes the validated campaign definition plus resolved race-content closure. Later departures/settlements read this save-owned snapshot. Management v1 remains readable; old campaigns use the isolated compatibility adapter and are not assigned fabricated authored history.

### CR-04 — Rival planner contained balance literals — closed

The bounded rival algorithm correctly lived in code, but cash thresholds, per-plan spending and capability-gain coefficients were hard-coded beside it.

**Resolution:** `CampaignRivalPolicy` keeps the supported algorithm/vocabulary code-owned while moving numerical tuning into the authored campaign. Existing 15-field rival records remain valid and use an explicit legacy policy only for compatibility.

### CR-05 — Five source files exceeded the repository line budget — closed

The executable policy is 400 code lines for source. Exact review found five violations on the branch:

| File before split | Code lines before | Resolution |
|---|---:|---|
| `scripts/domain/race_sim.gd` | 754 | dispatch aggregate + foundation/core/operations layers |
| `scripts/ui/weekend.gd` | 623 | concrete live view + shared interaction/support base |
| `scripts/composition/main.gd` | 546 | campaign orchestration extracted to `CampaignScreens` |
| `scripts/ui/pitwall_workspace.gd` | 419 | finishing-guide composition extracted |
| `scripts/ui/race_weekend/minimal/workspace.gd` | 410 | timing-table presenter extracted |

Post-split code-line counts are 257/176/255/93 for the RaceSim chain, 290/337 for WeekendView, 373 for the native shell, 395 for PitwallWorkspace and 381/42 for the Minimal workspace/presenter.

The splits are responsibility-based; no assertions, comments or formatting were compressed to pass the metric.

## Data-driven boundary after the pass

New gameplay instances use validated content for vehicle, roster, teams/drivers, tyres and thermal profiles, allocations, setup, race/environment/operations/competition tuning, weekend configuration, circuits/styles, scenarios, mechanic profiles, editor profiles **and campaign profiles**.

The following remain intentionally code-owned:

- content/checkpoint schema and migration versions;
- bounded identity and collection limits;
- permitted mechanic providers and hook order;
- deterministic algorithms and state machines;
- allowed campaign role/facility/rival strategy vocabularies;
- security/resource limits;
- compatibility constants required to reproduce pre-content saves.

These are contracts or safety boundaries, not game-content instances or balance tuning.

## Compatibility and authority checks

The refactor preserves:

- native Godot and the current race tick/RNG ownership;
- `RaceSim` as the public aggregate type and all mechanic hook names;
- `WeekendView`, `PitwallWorkspace`, Minimal workspace and main-shell public behavior;
- standalone weekend construction and content freezing;
- exact campaign/weekend manifest and exactly-once settlement boundaries;
- v1 management envelopes and 15-field rival records;
- legacy race/content compatibility tables exclusively for old saves/direct compatibility paths;
- no UI-owned simulation, persistence or campaign authority.

## Verification expectations

Publication requires the exact PR head to pass the existing repository gates:

- six registered Godot shards plus aggregate verification;
- generated schema/content/exported-runtime checks;
- architecture guard and Python unit tests;
- runtime-confidence workflow;
- Linux/Windows standalone build and native smoke;
- advisory quality comparison.

Human usability, accessibility, campaign balance and representative-hardware performance remain product-validation activities; automated success is not evidence for those outcomes.
