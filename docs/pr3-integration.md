# PR #3 — UX and recovery integration

## Merge inputs

The resolution joins the existing UX branch at `e0d7f8356ae89ce92d58ba9ade926f4df6ac659c` with `main` at `0c6a09b416ca529c898b23073bebcc07f2c438b9` (the merge of PR #4). Their common ancestor is `e5e849ece8430ead5c9cfb72cd8ddc105b53b6ac`. The merge keeps both parent histories; it is not an ours/theirs replacement or a force push. It updates PR #3 only, not main directly.

The source snapshots used for the three-way merge came from the repository's tracked-source artifacts. The PR tree was verified as `62a378c259238dd3968ed8ec9c13cd837c1dae6c`; the incoming main tree was verified as `6ac5596f7f74f6d2be6f6b913c0e083f87712313` before editing.

## Text conflicts

Six files required explicit resolution: `README.md`, `docs/README.md`, `project.godot`, `scripts/ui/main.gd`, `scripts/ui/strategy_desk.gd` and `scripts/verify.py`.

Version 0.9.0 is retained. The documentation now distinguishes the combined version from both historical 0.8 milestones. The main menu retains Recovery scenarios and the existing launches. New normal weekends use RecoveryRaceSim; every supported strategy-derived model is presented by the task-oriented pit wall. The application service auto-merge keeps both the text preference and RecoveryRaceSim restoration.

The compact button helper retains explicit pre-tree primary styles, the UX hover border and recovery's hover-pressed state. The verifier runs both branches' full test sets; no domain or UI suite was dropped to make the merge compile.

## Semantic integration

Removing markers alone would have selected one of two competing weekend views. The combined hierarchy is now:

`WeekendView → StrategyWeekendView → WeatherWeekendView → RecoveryWeekendView → PitwallWorkspace`.

Recovery adds its panel and explicit-driver shortcuts before the workspace groups and scales those controls. Conditions includes Recovery, and Find view exposes it only for recovery-capable models. Weather/legacy strategy views do not receive a nonfunctional recovery destination. A direct Recovery shortcut explicitly reopens a previously closed inspector even when that topic was already selected.

The merged recovery pane retains its own driver selectors and Protect / Repair only / Retire actions. The workspace's Close and Expand remain available without duplicating another driver-selector row. Incoming controls receive the same native text-size preference. Repeated debrief refresh replaces the recovery prefix instead of appending it to a cached parent debrief indefinitely.

Recovery domain code, physical service, virtual-neutralization rules and checkpoint v8 are carried from main without edits. UX groups, structured car summaries, view search, 100/115/130% native text, message history and the strategy-draft leave guard are preserved. The text preference does not scale the custom circuit labels or the editor. The strategy leave guard is not a global transaction manager for every recovery-authority editor.

## Verification

The recovery UI regression is extended to cover Conditions navigation, closing/reopening the same recovery topic, repeated debrief refresh, explicit driver targets and the recovery/search controls at 130% text in a 1100×720 viewport. The inherited UX suite also runs against weather and legacy strategy models.

Run `python3 scripts/verify.py --godot /path/to/godot`. The runner imports a fresh project, isolates user data, rejects script errors and emits suite reports plus native screenshots. The final `reports/verification.json` and CI run attached to the merge are authoritative; no historical check count is presented as a result for this merge.

This integration does not imply accessibility certification, forecast calibration, broad performance improvement or completion of all GDD stages. It resolves the merge while preserving both tested feature sets.
