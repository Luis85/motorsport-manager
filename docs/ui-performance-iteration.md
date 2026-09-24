# Compact pit wall and performance — implementation log

Baseline: native 0.6.0, `4966c577380e3c80c693d70417a68c525be3070b`, tree `ca772af77a6bcd6ad9efe7e73f605117d273194d`.

## User-reported problems

Oversized/clunky UI, unreadable hover states, scrolling menus and hard-to-find actions. This iteration improves the existing experience rather than adding Stage C mechanics.

## Audit and intended changes

The 1100×720 baseline stacks the application header, weekend heading, phase steps, time controls and wrapped map controls above a short workspace. Driver summaries are duplicated in the inspector and fixed cards. Major topics use a dropdown inside the inspector; strategy approval sits at the bottom of a long scrolling form. Popup and tooltip palettes are not fully specified. Hidden tyre, setup and strategy views continue refreshing.

Use compact consistent control dimensions and explicit hover/focus/pressed/disabled palettes. Expose task navigation directly, keep both drivers' primary actions persistent, open detail on demand and pin commit controls outside scrollable content. Group secondary data without deleting capabilities. Preserve drafts and keyboard focus. Keep the paper/green/brass identity, native Godot controls and dot cars.

## Performance contract

Measure the same 12-car, 24-lap, seed-7314 Monaco workload at 1100×720 before and after. Separate synchronous UI-refresh costs, uncached forecasts, paused redraw counts and native frame times. Reference environment: Godot 4.7.2 Standard, AMD EPYC 9V74, Linux X11/Xvfb, Mesa llvmpipe software rendering. Measurements are local diagnostics, not hardware-independent FPS promises.

Only presentation work may be skipped/cached. Do not change the authoritative 0.05-second step, RNG, sporting rules, inventory, strategic commands or saved race schema. Existing domain and native UI tests remain required. Add reachability, popup contrast, draft/focus continuity, hidden-work and observational-rendering regressions.

Implementation and validation are in progress. Final behavior, measurements and evidence will replace this progress status after verification.
