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

**Resolution:** added `core.weekend.campaign-starter`. The campaign references that weekend by stable ID, authors a circuit ID per event, and freezes the resolved circuit documents, roster, tyres, setup, tuning, mechanic profile and vehicle definition through the ordinary race-content boundary.

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
| `scripts/domain/race_sim.gd` | 754 | dispatch aggregate + simulation port + foundation/core/operations layers |
| `scripts/ui/weekend.gd` | 623 | concrete live view + shared interaction/support base |
| `scripts/composition/main.gd` | 546 | campaign orchestration extracted to `CampaignScreens` |
| `scripts/ui/pitwall_workspace.gd` | 419 | finishing-guide composition extracted |
| `scripts/ui/race_weekend/minimal/workspace.gd` | 410 | timing-table presenter extracted |

At the first PR #28 split, code-line counts were 258/64/130/255/93 for RaceSim/port/foundation/core/operations, 290/337 for WeekendView, 373 for the native shell, 395 for PitwallWorkspace and 381/42 for the Minimal workspace/presenter.

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


## PR #29 comprehensive quality and compatibility closure

Implementation reviewed at `0adb331ba47dadf4284f47004c7d28de2927166b`, stacked on PR #28's `c02b095`. The earlier green PR #28 source `c7d1e2c7de95e9bae91b935642e1c7d6967de8bb` is historical evidence: the later compatibility-removal commits broke consumers and cannot inherit its pass.

### CR-06 — Removed campaign save paths broke storage — closed

Restored `CampaignCheckpoint.upgrade`, legacy starter/frozen configuration, economy migration and explicit legacy payroll/facility/development indexes. Checkpoint migration normalizes a version-one economy before constructing later personnel/operations/engineering authorities, preserving factual cash and obligations without fabricated history. Registered contracts require lossless populated migration and caller nonmutation.

### CR-07 — Nested malformed values could bypass guards — closed

Campaign projection validators reject wrong collection-row types before dictionary access or typed construction. Frozen campaign race options now use the production roster, tyre, setup and tuning readers before reference checks; valid definition IDs alone cannot authorize malformed nested payloads. Imported pit lanes require an explicit point array: a missing `nodes` field previously raised an engine error and returned an empty validation result. Native regression cases cover exact rejection, retained editor state and input nonmutation while keeping explicit empty pit-point arrays supported.

### CR-08 — Full quality inventory and tool assumptions — closed

The recorded baseline contained 5,075 findings across 507 code files. Explicitly authorized formatting and cohesive responsibility extraction closed GDScript/Python lint, formatting, complexity and physical-line findings without suppressions, weakened assertions or policy changes. Production sources remain at most 400 physical code lines; tests at most 450; the complexity review ceiling remains 15. Race state, movement/session calculation order, accepted command order, RNG draws and save versions retain their existing owners.

The complete strict local scan at the reviewed source reports **611 code files, zero findings and complete analysis**. Tooling now understands inherited/multiline GDScript contracts, retains malformed-output failures and validates fresh source-bound aggregate evidence. Workflow action pins and artifact-digest checks are maintained. All registered suites remain mandatory; extracted test helpers do not substitute a smaller gate.

### CR-09 — Historical handoffs appeared to be live backlog — closed

The documentation pass distinguishes archived PR #20/0.4 port notes from current contracts, updates campaign checkpoint v6 references, and links implemented TM-07–TM-16/correction owners instead of describing them as missing dependencies. TM-01–TM-16 implementation remains closed. Dedicated specialist management presentation, richer simulation, human playtesting, comprehensive accessibility, balance and controlled device/performance acceptance remain separate work. No hardware, human or balance sign-off is inferred.

## Remote backlog inventory — observed 3 October 2026

Read-only GitHub queries returned the following snapshot before documentation integration:

| Inventory | Observed result | Interpretation |
|---|---|---|
| `repo:Luis85/motorsport-manager is:issue is:open` | No open issues returned | No named issue backlog was available from this search |
| Inline review threads on PR #25, #28 and #29 | Empty thread lists | No unresolved inline review thread was returned on these PRs |
| Open pull requests | #25, #28, #29 | PR #28/#29 are this native closure; PR #25 is concurrent Littlewild feature work |
| Milestones | Zero open and zero closed | The [public GitHub milestones page](https://github.com/Luis85/motorsport-manager/milestones?state=open) returned an empty repository milestone inventory at 09:53 UTC |

The connector did not support the milestone endpoint, so the read-only public-page fallback was checked. Its embedded payload identifies `Luis85/motorsport-manager`, reports `milestones.totalCount: 0` with empty edges, and reports both open and closed counts as zero.

[PR #25](https://github.com/Luis85/motorsport-manager/pull/25) changes Littlewild concept sources and workflows, with no native `scripts/`, `tests/` or `data/` changes. Its five shared workflow diffs update Action pins; they identify no separate native gameplay defect for this pass. A future integration must preserve current artifact-integrity and source-evidence checks. This audit neither merges that feature nor closes remote work.

## Final integration evidence

Latest observed PR #29 source: `2f9251d2cbfaa5893ceda1312d4f5da308b3235b`. Its strict quality scan remains complete with 611 code files and zero findings; all 208 Python tests pass. Hosted Runtime confidence and Advisory code quality are green. The other required gates are still running at this observation, so a final hosted pass is not claimed.

A zero-finding local quality report establishes the configured metric result for its named source. Final functional acceptance belongs to the exact merged/integrated source and fresh [PR #29](https://github.com/Luis85/motorsport-manager/pull/29/checks) and [PR #28](https://github.com/Luis85/motorsport-manager/pull/28/checks) workflows. Six-shard gameplay/native UI, content/exported runtime, runtime confidence and packaged smoke results must be read with their source IDs; this documentation pass does not reuse or invent a later final-head result.
