# Race weekend: legible stakes, earned tension, trustworthy outcomes

Research and implementation review, 26 September 2026. Target: PR #12, native Godot 4.7.2. Inspected baseline: `a41abeba4b00faa1689fc999392e94d78cb24488`; this supplements, rather than replaces, the Race Weekend GDD and [existing pit-wall UX research](pitwall-ux-research.md).

## Executive decision

Improve the player's ability to understand the race already being simulated before adding more management meters. The intended loop is **notice a meaningful situation → compare a trade-off → explicitly approve or deliberately wait → watch physical execution → inspect the recorded outcome**. Calm running is a legitimate state. A reading panel is not a new strategy owner, a compulsory objective system, or a mechanism for manufacturing drama.

The implemented increment fixes misleading empty-state language and stale observations, then adds a contextual **Read the race** surface. It exposes evidence, a choice and a next observation for both named drivers, with an optional fixed reading snapshot. It does not replace the existing strategy, pit service, weather, radio, replay or result workspaces.

## Research method and limits

Reviewed primary academic work, designer-authored material, official game descriptions, engine guidance and accessibility guidelines. The questions were: what makes a decision feel owned; how to communicate uncertainty without turning management into guesswork; how to maintain interest between interventions; how to distinguish a call from its outcome; how to keep two-car attention manageable; and what engineering evidence is needed before calling a change safe.

Publisher descriptions establish advertised design choices, not independent satisfaction, sales or retention evidence. Academic findings motivate hypotheses; they do not validate this implementation. No player interview, controlled usability study, disability-access session or commercial market-size analysis was performed. This is a source-grounded design and engineering pass, not a claim that automated checks measure fun. Source summaries and this game's adaptations are separated below.

## Findings and adaptations

### 1. Make competence and agency visible

Ryan, Rigby and Przybylski report four studies relating psychological need satisfaction, including autonomy and competence, to aspects of game enjoyment and preference. Intuitive controls also matter in their model [R01]. MDA distinguishes mechanics, their runtime dynamics, and the experience they produce; its useful lesson here is to evaluate the experience rather than count features [R02].

**Our adaptation:** a player should be able to answer “Why might I act now?”, “What would I give up?”, and “What would count as evidence that it worked?” Existing finite tyres, fuel policy, physical pits and strategy authority already create costs. The new reading joins these facts into an understandable situation. It never approves a plan, changes ownership or spends a resource. A quiet queue now says **No open issue**, not **On plan**: absence of a warning does not establish an approved or successful strategy.

### 2. Reduce administration, not meaningful trade-offs

Golden Lap's official materials position a reduced-micromanagement racing management experience around consequential decisions [R03]. Motorsport Manager's publisher description connects preparation, practice, qualifying and evolving race strategy [R04]. F1 Manager 2024 describes race-day decisions, presentation, mechanical problems, tutorials and replay scenarios [R05]. These are precedents, not instructions to reproduce the size of any competitor.

**Our adaptation:** retain the existing task workspaces and two-car command boundary. Add no mandatory “engagement” task and no repeating click-to-collect reward. The reading action is always **Read both drivers**, so a changing spotlight cannot silently retarget a focused button. The visible live spotlight can prioritize the teammate's critical issue, but the opened snapshot preserves both complete identities and the player's reading position. Full radio remains directly reachable.

### 3. Communicate uncertainty rather than hidden answers

The TUM-hosted abstract of Heilmeier, Graf and Lienkamp describes a lap-wise strategy model involving tyre degradation, fuel, pits and overtaking. Only its abstract/metadata were reviewed, not the full paywalled paper [R06]. Into the Breach's official description makes telegraphed enemy attacks part of its decision structure [R07]. That is a legibility analogy, not permission to reveal unavailable motorsport information.

**Our adaptation:** display actual own-car state, public physical contest state, and already available estimates. A potential rejoin remains a range, a fuel margin remains an estimate, and an active battle is not a guaranteed pass. Rival fuel, tyre condition and future pit plans are not inputs to the reading. Missing optional forecasts must not suppress actual low-fuel, damaged-tyre, blocked-plan or terminal-state checks. The original forecaster and command validator remain authoritative.

### 4. Let tension emerge; do not rig the race

Valve's Left 4 Dead presentation discusses peaks and valleys of intensity, and an AI Director that changes enemy population to shape pacing [R08]. This is a useful contrast: the presentation problem is relevant, but outcome manipulation would conflict with this game's simulation contract.

**Our adaptation:** rank observations only. An active on-track pair can become the story; a car approaching an accepted stop can become the story; actual remaining distance can justify “Closing laps.” No extra puncture, safety car, weather transition, rubber-banding or photo finish is injected. Selection, camera, speed, pause state, random generator and checkpoint state remain untouched. Between meaningful events, “let the stint develop” explains why waiting can be intentional rather than telling the player that the game has nothing to do.

### 5. Close the loop with evidence, not congratulatory fiction

This is a project-specific inference from the agency and uncertainty findings, not a separate empirical finding: trust requires the interface to distinguish **accepted order**, **physical execution**, **observed result**, and **causal explanation**.

The implementation differentiates approach, pit entry/service and recorded exit. A completed service is not yet an exit; total visit duration is not net race-time loss. An active overlap is not a completed pass. Engine handback is not proof of fuel saved. A grid-to-finish change is not proof that one command caused it. Recent observations link back conceptually to the existing retained decision chain. The reading scans at most 128 retained journal rows and displays at most four matching observed records; absence from that bounded view does not imply absence from the race. Journal truncation is disclosed.

### 6. Separate urgency from reading pressure

Xbox Accessibility Guideline 103 recommends additional channels for important cues [R09]. Guideline 113 discusses reliable, visible focus [R10]. Guideline 116 addresses interface time limits while distinguishing core gameplay timing [R11]. Godot's native focus guidance supplies the relevant keyboard/controller implementation model [R12].

**Our adaptation:** critical labels remain textual rather than color-only. Reading does not overwrite itself while the race changes. The player can explicitly pause before opening it; opening it does not secretly pause or extend the sporting deadline. Both compact and wide layouts retain an entry point. Native Tab reaches selectable reading text, Page Up/Down reaches long evidence, and Escape restores the invoker. These software checks do not certify screen-reader announcements or physical controller behavior on an untested operating system.

### 7. Treat responsiveness and verification as product quality

Godot's optimization guidance stresses measuring bottlenecks, retesting changes, and respecting hardware-dependent results [R13]. GitHub's concurrency guidance explains that runs sharing a group can cancel one another [R14].

**Our adaptation:** retain controls, avoid redundant content assignments, bound journal work and reuse the existing forecast cache. Measure capture cost without claiming a portable frame-rate guarantee. Keep the complete native verification pipeline. Separate push and pull-request concurrency groups so a branch run cannot cancel required test-merge verification. The historical compact-test user-data contamination repair is preserved; this pass does not remove those assertions or delete real player data.

## Product review and disposition

| Perspective / stage | Risk or question | Disposition in this increment |
|---|---|---|
| Entry and onboarding | Does the next action teach a decision, or add a second tutorial system? | Retain the real contextual guide; reading reinforces notice/compare/approve/observe. No new required tutorial or hidden action. |
| Preparation and ownership | Does a quiet UI imply that a strategy has been approved? | Repair queue wording; the reading reports actual plan presence and ownership continuity. |
| Practice | Are resources and measured learning meaningful? | Preserve real programme costs and comparable evidence; contextual reading points to those records, not an invented bonus. |
| Qualifying | Can the player distinguish garage choices from an active attempt? | Reading changes with garage/out/hot/in-lap state, valid best lap and release feasibility. It does not promise another valid lap. |
| Live attention | Can the second driver's urgent issue disappear? | Stable two-driver slots; actual safety/resource checks survive missing forecasts; terminal slots clear stale actions. |
| Racecraft | Can stale outlines imply a battle after selection, finish or session change? | Repair invalidation and share a pure observed-contest adapter. Exclude recovery, resolved and inactive pairs. |
| Strategy and waiting | Is every update an instruction to pit? | Preserve acknowledgement and explicit approval; explain staying out as an option. No repeated new toast or automatic order. |
| Physical pit visit | Does acceptance look like completion? | Distinguish active order, physical entry/service and measured exit. Existing shared-box/frozen-service UI stays authoritative. |
| Weather and recovery | Would extra scripted drama break predictability? | Keep public outlook, alternatives and recovery systems; no new weather/reliability manipulation. |
| Results and learning | Does success credit an unsupported cause? | Recorded outcomes only; no new settlement, causal score or original-result replacement. Sandbox origin is explicit. |
| Interaction and accessibility | Can the user actually read long explanations at 130% text? | Fixed reading, native keyboard scrolling, explicit dismissal and focus-return checks at compact/wide sizes. |
| Performance and architecture | Does a helpful sidebar rescan or mutate the simulation? | Pure read models, bounded journal window, retained native controls, non-interference tests and local timing evidence. |
| Delivery reliability | Can one successful CI event conceal cancellation of another? | Independent event/ref concurrency; keep both push and pull-request test-merge runs. |

This is a focused closure of reproduced presentation and reliability gaps. It is not a declaration that every future GDD package, every balance issue or every platform release gate is complete.

## Acceptance and human playtest plan

Engineering checks are in `tests/ui_polish_tests.gd` and the full `scripts/verify.py` runner. Boundary fixtures are labeled; pit acceptance and subsequent movement use the real native controls and unchanged simulation. See [polish verification](../ui/race-weekend/polish-verification.md) for exact evidence and limitations.

The next human evaluation should use the existing dry, weather and recovery scenarios, not a specially scripted demonstration that guarantees success. Include newcomers and experienced management players. Before an intervention, ask the player to name the affected driver, evidence, two viable choices and expected cost. After the visit or contest, ask what happened and what remains uncertain. Observe whether waiting feels deliberate, whether the teammate is neglected, whether the new reading interrupts more than it helps, and whether the player confuses an estimate with a measured result.

Proposed acceptance questions, not measured results: can a newcomer explain one trade-off without coaching; can they find the second driver's urgent issue; can they dismiss/reopen the reading and recover their control focus; can they identify an executed stop without mistaking its visit duration for net loss; and can they explain a disappointing result without attributing it to a fabricated cause? Record task completion, misinterpretations, time spent searching, unwanted interventions and qualitative tension/agency reports. Compare against the baseline using matched scenarios and counterbalanced order. Numerical success thresholds should be agreed before the study, not chosen afterward.

If the reading is repeatedly ignored, shorten or retime the visible story before adding more systems. If players still cannot explain a choice, improve the specific evidence and comparison. If the underlying optimum becomes universal, address balance with seeded simulation experiments and explicit domain changes in a separate reviewed increment; presentation alone cannot repair a dominant strategy.

## Source register

Accessed 26 September 2026. Each source supports the adjacent finding, not proof of this game's engagement.

- **R01 — Ryan, Rigby & Przybylski (2006), The Motivational Pull of Video Games.** Original academic paper; abstract and relevant results inspected. https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf
- **R02 — Hunicke, LeBlanc & Zubek (2004), MDA.** Original design framework, including the mechanics/dynamics/experience relationship. https://users.cs.northwestern.edu/~hunicke/MDA.pdf
- **R03 — Golden Lap, official publisher description.** Comparator positioning only. https://store.steampowered.com/app/2052040/Golden_Lap/
- **R04 — Motorsport Manager, official publisher description.** Advertised preparation/session/strategy loop. https://store.steampowered.com/app/415200/Motorsport_Manager/
- **R05 — F1 Manager 2024, official publisher description.** Advertised race-day feedback, mechanical issues, tutorials and replay scenarios. https://store.steampowered.com/app/2591280/F1_Manager_2024/
- **R06 — Heilmeier, Graf & Lienkamp (2018), A Race Simulation for Strategy Decisions in Circuit Motorsports.** University abstract/metadata only; no claim of full-paper review or model calibration. https://portal.fis.tum.de/en/publications/a-race-simulation-for-strategy-decisions-in-circuit-motorsports/
- **R07 — Into the Breach, official publisher description.** Intent-telegraphing analogy; not a motorsport model. https://store.steampowered.com/app/590380/Into_the_Breach/
- **R08 — Michael Booth / Valve (2009), The AI Systems of Left 4 Dead.** Designer presentation, especially pacing slides 78 and 85 (one-based). Population manipulation is explicitly not adopted. https://steamcdn-a.akamaihd.net/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf
- **R09 — Xbox Accessibility Guideline 103.** Additional cue channels. https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/103
- **R10 — Xbox Accessibility Guideline 113.** Focus and navigation. https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/113
- **R11 — Xbox Accessibility Guideline 116.** Interface time limits; not removal of core race timing. https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/116
- **R12 — Godot, Keyboard/Controller Navigation and Focus.** Native GUI implementation guidance. https://docs.godotengine.org/en/stable/tutorials/ui/gui_navigation.html
- **R13 — Godot, General Optimization Tips.** Measurement and hardware limits. https://docs.godotengine.org/en/stable/tutorials/performance/general_optimization.html
- **R14 — GitHub Actions, Control Workflow Concurrency.** Group cancellation semantics. https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency
