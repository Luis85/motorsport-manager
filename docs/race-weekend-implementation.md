# Race-weekend GDD implementation

Design basis: Motorsport Manager — Race Weekend GDD v1.0, supplied 23 September 2026. Baseline: `e340eb4959922ed86dc6ff72628e856334102466` (native Godot 0.4.0).

## Binding boundaries

Keep native Godot, flat dot cars, two Obsidian drivers, the existing track compiler/editor, physical pit routes, finite driver-owned four-wheel tyre sets, fixed 0.05-second simulation steps, session approvals and player-controlled pause/speed. No hidden race manipulation, automatic alert pauses, campaign economy, web runtime or track-editor redesign.

## Delivery sequence

1. **Decision foundations (RW-01/RW-02/RW-06):** versioned journal, explicit driver targeting, validated strategy windows, independent ownership and expiring resource overrides. Save migration must preserve legacy behavior without inventing history.
2. **Strategy and consequence (RW-03/RW-04/RW-07/RW-08):** immutable own/private + rival/public information boundary, bounded forecasts, physical pit-loss/rejoin estimates, finite-stock alternatives, decision-aware rivals and measured pit outcomes.
3. **Playable pit wall (RW-05/RW-16):** persistent two-car summaries, stable decision controls, explicit drafts, comparisons, ownership, forecast staleness, recoverable explanations and causal debrief. Keep time controls unchanged.
4. **Verification and polish:** deterministic fixtures, save/load and rejection cases, dry strategy comparisons, native UI regressions, small-window screenshots and documented remaining GDD work.

Each implementation milestone is committed separately. The full GDD is a staged design, not a claim that all subsequent systems already exist. Optional practice, replay branches, new sporting formats, component distinctions and other later packages are not complete until implemented and verified.

## Acceptance evidence

Run `python3 scripts/verify.py` with the repository-pinned Godot runtime. Preserve the existing domain and native UI suites. New fixtures must cover observational forecasts, explicit command recipients, domain-specific overrides and handback, approved versus physically committed stops, stale advice, legacy checkpoint migration, two-car queue costs, deterministic replay of fixed-step commands, and measured-versus-estimated debrief vocabulary.

Automated assertions and screenshots do not establish player enjoyment, balanced strategy across all circuits, forecast probability calibration, accessibility certification or exploratory playtest completion. Those remain separate validation activities.

## Status

Implementation branch created. Baseline source archive was verified against Git tree `0a6adafddbf7631969448966bdc230c728305c8d`. Runtime verification and implementation are in progress; completed work and actual evidence will be recorded below as milestones land.
