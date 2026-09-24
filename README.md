# Motorsport Manager — Godot

A native, local-first motorsport game: **author a circuit, qualify your drivers, manage the race from the pit wall**. Current implementation: **0.11.0 — contextual rivals and a calmer pit wall**.

## Open and play

Use **Godot 4.7.2 Standard**. Import the root `project.godot`, allow script import, then press **F5**. No npm, .NET, browser, external asset service or Godot plugin is required.

Start **Grand Prix Weekend → Pinecrest Motor Park → Formula → Dry**. Engineers can handle qualifying releases. Approve preparation, formation and starting lights when ready. Manage **Daniel Mercer (MER)** and **Lucas Moreau (MOR)**. Space pauses; 1–5 selects 1×–16×. Track Editor, Settings and Continue Weekend remain available.

Try **Scenario challenges → Practice → Spend a set to learn** or **Two setups, one question** for optional preparation. New normal weekends include practice plus the existing recovery model. **Scenario challenges → Recovery → Protect the finish** and **Is the repair worth it?** remain available. Earlier dry/weather learning recipes and migrated saves retain their original model semantics rather than silently switching rules.

## Contextual rivals and a calmer pit wall

New normal weekends enable four bounded rival tendencies: track-position protector, opportunistic undercutter, long-stint conservator and adaptive risk-taker. They select feasible existing forecasts, use their own stock and the same physical pit routes, and cannot inspect player drafts or future weather. **Scenario challenges → Rival styles** offers two disclosed preparation starts; **Team → Battles → Rival field** explains public tendencies and actual stops. Pressure is deliberately deferred, not represented by another meter.

One fixed session/time header replaces duplicated strips. **Weekend** holds save/export/guide/menu; **Messages** remains beside Find. Strategy **Compare / Plan / Control / Practice** shares one navigation row. Both cars show current resource intent/owner and pit owner. All three default comparisons fit at supported enlarged-text sizes. Dialog rich text, native menu focus and public rival inspection are corrected. Checkpoint **v10** preserves new profiles; native v1–v9 saves retain classic rival behavior.

See the [0.11 behavior and scope](docs/race-weekend-rivals.md), [workspace specification](docs/design/pitwall-workspace.md) and [verification evidence](docs/rivals-verification.md). The older practice/integration measurements below remain their own historical results, not claims about this build.

## Optional practice and measured learning

At briefing, **Optional practice** opens **Strategy / Practice**. Choose a tyre-life, qualifying-preparation, setup-comparison or wet-learning objective, a real driver-owned set, one to four measured laps and an explicit setup baseline. Each driver has three run opportunities and independent unapplied drafts. **Run**, **Recall** and **End practice** remain above scrolling evidence.

Runs follow physical departure, out/measured/in laps and garage return. They consume finite tyre condition, fuel and lifetime health. Interrupted runs retain partial measurements; practice times never set the qualifying grid. Comparable clean full laps can inform bounded forecast estimates, not physical car performance. Traffic-limited observations remain visible without creating false confidence. Skipping retains the baseline and normal delegation, with no hidden penalty or perfect setup score.

Review the notebook, explicitly end practice and return to briefing before qualifying. Find view and the resumable guide include practice. Text sizes 100%, 115% and 130% preserve access at both supported desktop sizes. Practice evidence was introduced in checkpoint v9 and is retained in current **v10**; native v1–v8 saves retain their original behavior without fabricated practice history. Unapplied practice drafts do not survive application restart.

See the [0.10 practice handoff](docs/race-weekend-practice.md) for commands, learning tolerances, migration, scenarios and verification: **1,869 passing local checks / 79 native screenshots**, including 162 new checks and a complete physical practice-to-race weekend. This is the first RW-17 increment, not all of Stage D or completed human validation.

## Task-oriented pit wall

**Watch, Strategy, Car, Team, Conditions and Review** organize the existing views. Related topics share a contextual inspector. **Conditions → Recovery** and both drivers' direct Recovery buttons open the same recovery controls. **Find view / Ctrl+K** browses or searches available destinations; it never executes a race command.

Structured driver cards show position, fitted set and weakest-wheel tread, estimated finish-fuel margin, next stop and pit responsibility. Named Details actions expose the full issue and battle context. Both cars retain their fixed Compare/Box/Keep/Save-fuel or session-appropriate release/recall actions, alongside Weather and Recovery.

Strategy alternatives remain together with explicitly unapplied/approved states, uncertainty bands and faster/slower wording. Approvals and primary recovery commands stay separate from scrolling analysis. Ordinary navigation does not approve a draft, issue an order or seize time control.

Settings offers staged **100%, 115% and 130% pit-wall text**, applied when reopening the weekend. Native controls, popups and relevant dialogs scale; custom-drawn circuit labels and the editor do not. Messages retains the view's last 50 command acknowledgements/errors. Menu/Quit warns before abandoning user-edited strategy drafts; this is not cross-restart draft persistence or a global guard for every editor.

The [UX research record](docs/design/pitwall-ux-research.md) maps 16 primary sources to the interface decisions and explicitly separates guidance from human-validation claims. The [integration record](docs/pr3-integration.md) explains the combined view, conflict resolution and verification. The earlier [compact rendering/performance record](docs/ui-performance-iteration.md) remains historical evidence, not a new performance claim for the merged version.

## Recovery and race control

**Staged condition:** normal/warning/degraded/critical/retired scalar condition, accumulated thermal/condition exposure and separate persisted reliability/service random streams. Read-only comparisons show continuing, protecting engine resources and making a real repair-only stop. Repair retains the fitted tyres and removes damage, **not lifetime health**. Retirement requires a named confirmation.

**Explicit authority:** an additional critical repair requires permission, engineer pit ownership, approved emergency policy and a repair-work budget. Stale actions and impossible requests are rejected rather than silently replaced. Alerts, confirmations and guides never pause or slow the race automatically.

**Virtual neutralization:** a fictional reference-envelope speed target, no passing, no artificial catch-up or field bunching, an explicit ending interval and persistent local-yellow zones. This is not a physical safety car or licensed-series regulatory completeness. See the [recovery handoff](docs/race-weekend-recovery.md) for exact rules and limitations.

**The v8 recovery schema**, retained inside current v10 application checkpoints, preserves recovery, service and control state. Supported native v1–v7 saves migrate while retaining their original weather, reliability and flag behavior. Application presentation preferences remain separate. Browser saves are not compatible.

## Preserved systems

Finite four-wheel tyre stock; independent driver plans and control ownership; temporary intents; physical pit routes/service and a shared box; uncertain rejoin forecasts; persistent battles and safe team cooperation; observation-only weather and rival decisions; out/hot/in qualifying; formation, grid and lights; stable timing, telemetry, surface inspection and measured debriefs remain.

Circuit Atelier retains eight bundled circuits, Bezier editing, references, pit lanes, annotations, multi-selection, transforms, alignment/distribution, scenery groups and connected freehand/pen tracing. Authoring and a running race use separate compiled snapshots. Flat dot cars, warm paper/green/brass presentation, cached scenery, road batches and retained paused overlays remain. This merge does not redesign the editor or add campaign economics.

## Verify

```sh
python3 scripts/verify.py --godot /path/to/Godot_v4.7.2-stable_linux.x86_64
```

Alternatively set `GODOT_BINARY` or put `godot` on PATH. Linux native UI tests require a display or `xvfb` plus `xauth`. `--headless-only` explicitly skips rendered UI. The verifier imports a clean copy, isolates user data and rejects script errors as well as failed assertions. It includes practice and recovery domain/scenario/UI suites **and** compact UX, text-size/navigation and observational-performance suites. Reports and native captures are written to `reports/`; CI publishes evidence and the Source project workflow archives tracked source.

The generated `reports/verification.json` is authoritative for that run's counts. Historical handoff counts describe their own releases, not this combined tree. See [documentation](docs/README.md) for systems, formats and acceptance boundaries.

## Remaining scope and provenance

Broader practice calibration, replay branches, contextual wet rival strategy and driver pressure and once-only campaign settlement remain later work. Physical safety cars, field bunching, red flags, full stewarding and itemized component engineering are not implemented by this slice. Human comprehension, full accessibility/controller/screen-reader coverage, broader balance, forecast calibration and hardware profiling remain open; there is no universal frame-rate guarantee.

The seven geographic outlines derive from Tomislav Bacinger's MIT-licensed `f1-circuits` through the supplied prototype; Pinecrest is fictional. Attribution remains in [third-party notices](THIRD_PARTY_NOTICES.md). These are unofficial reconstructions, not laser scans or certified circuit/vehicle simulations. Widths, elevations, pit routes and scenery contain authored estimates. No official championship branding, car models or driver likenesses are used. Code retains the repository's [MIT license](LICENSE), copyright Luis Mendez.
