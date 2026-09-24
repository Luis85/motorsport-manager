# Motorsport Manager — Godot

A native, local-first motorsport game: **author a circuit, qualify your drivers, manage the race from the pit wall**. Current implementation: **0.8.0 — staged recovery and virtual neutralization**.

## Open and play

Use **Godot 4.7.2 Standard**. Clone the repository, import the root `project.godot`, allow script import, and press **F5**. No npm, .NET, browser, external asset service or Godot plugin is required.

Start **Grand Prix Weekend → Pinecrest Motor Park → Formula → Dry**. Engineers can handle qualifying releases. Approve race preparation, formation and the starting lights when ready. Manage **Mercer (08)** and **Moreau (09)**. Space pauses; 1–5 selects 1×–16×. Track Editor, Settings and Continue Weekend remain available.

For the new increment, choose **Recovery → Protect the finish** or **Is the repair worth it?**. In the pit wall, open either driver's **Recovery** button or select **Recovery & race control**. New normal weekends use the latest model. Existing dry/weather learning recipes and migrated saves retain their original model semantics for reproducibility.

## What is new in 0.8

**Recovery decisions:** scalar normal/warning/degraded/critical/retired condition, accumulated thermal/condition exposure, separate persisted reliability/service random streams, and read-only keep/protect/repair comparisons. Protect saves engine resources for two laps and returns the previous engine owner. Repair only uses the physical pit route and shared box, retaining the fitted tyres and their wear. Repair removes damage, **not lifetime health**. Retirement requires confirmation.

**Explicit authority:** additional critical repairs require permission, engineer pit ownership, the approved emergency policy and a repair-work budget. Stale actions, unavailable tyre recovery and impossible last-entry requests are rejected rather than silently replaced. Alerts, confirmations and guides never pause or change playback speed automatically.

**One supported neutralization procedure:** fictional virtual running with a reference-envelope speed target, no passing, no artificial catch-up or field bunching, an explicit ending interval and persistent local-yellow zones. Pending incident requests apply before the next whole-field movement snapshot. This is not a physical safety car or a claim of licensed-series regulatory completeness.

**Native workflow:** fixed recovery actions outside scrolling evidence, persistent shortcuts for both drivers, independent authority drafts, the resumable **Protect the finish** guide, measured repair/control debrief, and corrected compact-button palette inheritance. Checkpoint **v8** preserves the new state; supported older native saves retain their original weather, reliability and flag behavior.

The [0.8 implementation handoff](docs/race-weekend-recovery.md) documents the exact rules, command boundaries, model limitations and evidence: **1,449 passing local checks and 54 native screenshots**. This is RW-14/RW-15 plus interaction work, not full GDD or human-playtest acceptance.

## Preserved systems

The pit wall includes **Compare / Plan / Control**, finite-set multi-stop plans, independent control ownership, bounded temporary intents, uncertain pit/rejoin estimates, persistent battles, safe team cooperation and shared-box priorities. Rivals respond to public stops and weather, not private player drafts or secret future conditions. Both driver cards and user time controls remain available.

Seeded weather has its own saved stream. **Weather & crossovers** separates observed rain from measured line/sector water and compares current/box/wait stress cases without presenting them as probabilities. Four dry and three weather scenarios remain; the new recovery recipes add two disclosed learning situations.

The foundation retains **flat dot cars**, warm paper/green/brass presentation, eight bundled circuits, out/hot/in qualifying, physical formation and start lights, finite driver-owned four-wheel tyres, staged setup, interpolated timing, stable classification, telemetry, surface inspection and atomic storage.

**Circuit Atelier** retains Bezier editing, references, pit lanes, annotations, multi-selection, planar transforms, alignment/distribution, scenery groups and connected Freehand/Pen tracing. Authoring and racing use separate compiled snapshots. This increment does not redesign the editor or add campaign economics.

See the historical handoffs for retained assumptions: [0.7 weather](docs/race-weekend-weather.md), [0.6 racecraft/team](docs/race-weekend-living-racecraft.md), [0.5 strategy](docs/race-weekend-implementation.md), and [0.4 authoring/race foundation](docs/iteration-4.md). Their then-current version and future-work statements are superseded by the latest handoff where applicable.

## Verify

```sh
python3 scripts/verify.py --godot /path/to/Godot_v4.7.2-stable_linux.x86_64
```

Alternatively put `godot` on PATH or set `GODOT_BINARY`. Linux rendered UI tests need a display or `xvfb` plus `xauth`. `--headless-only` explicitly skips native UI verification. The verifier imports a clean copy, isolates user data, rejects script errors, and writes reports and native screenshots under `reports/`. CI runs the same suite and publishes evidence. The **Source project** workflow archives tracked source into a project ZIP.

The generated verification report is authoritative for counts and timing. [Verification guidance](docs/verification.md) describes the preserved testing foundation; the [0.8 handoff](docs/race-weekend-recovery.md) records current coverage and limitations. New application checkpoints are v8; supported native v1–v7 saves migrate without silently switching their model. Browser saves are not compatible.

## Remaining scope and provenance

Purposeful optional practice, deeper rival/driver systems, replay branches and immutable once-only campaign settlement remain later work. Physical safety cars, field bunching, red flags, full stewarding and itemized component engineering are not implemented by this slice. Broader balance, forecast calibration, human comprehension and dedicated accessibility validation remain open; there is no frame-rate guarantee.

[Documentation index](docs/README.md) covers architecture, systems, formats, controls and boundaries. The seven geographic outlines derive from Tomislav Bacinger's MIT-licensed `f1-circuits` through the supplied prototype; Pinecrest is fictional. Attribution is preserved in [third-party notices](THIRD_PARTY_NOTICES.md).

These are unofficial reconstructions, **not laser scans or certified circuit/vehicle simulations**. Widths, intermediate elevations, pit routes and scenery contain authored estimates. No official championship branding, car models or driver likenesses are used. Project code retains the repository's [MIT license](LICENSE), copyright Luis Mendez.
