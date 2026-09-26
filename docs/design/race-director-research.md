# Race Director — race-weekend research and redesign

**Research and implementation date:** 26 September 2026  
**Application:** Motorsport Manager 0.16.0, native Godot 4.7.2 Standard  
**Inspected baseline:** merged main `6faeba52b8f82b153475f69eb8cc7961259c1994`, tree `dc158774436c6fb78843ad501779018cad1fe50b`  
**Decision:** replace the default pit-wall composition and interaction rhythm; retain the existing sporting simulation and deep engineering tools.

## 1. The problem is not a lack of systems

The starting game already has measured practice, qualifying, finite driver-owned tyres, physical shared-box stops, weather, resource ownership, named-rival tactics, forecasts, replay and evidence. The user nevertheless dislikes its UI and gameplay. Another row of controls would not answer that feedback.

The working diagnosis is that the interface foregrounds its systems rather than the player's job. Watching a race, understanding the immediate stakes, making a call and discovering what happened should be the main experience. Planning forms, authority details and journals should support that experience, not compete with it continuously.

This is a design hypothesis, not a diagnosis from participant interviews. The work combines public primary-source research, a source-level interaction audit, inspected native baseline captures and new native interaction tests. Competitive descriptions are the developers' descriptions, not claims that those games were played during this work. No interview, representative-device benchmark, accessibility certification or measured increase in enjoyment is claimed.

## 2. What the existing screen communicates

The recovered baseline is exact source, not an old mockup. Native `finish-duels-1440x900-100.png` shows the inherited paper/green shell: global session information, grouped navigation, contextual navigation, decision material, a timing table, map, wide analysis rail and driver controls all coexist. Its detailed tactical forms are useful but visually compete with live observation. Compact variants place further pressure on map height and reading space.

Five audit findings drove the change:

| Finding | Likely player cost | Design response |
|---|---|---|
| Many equally prominent destinations | “Where should I look now?” | Four stable default destinations and one contextual race message |
| Expert forms share the live canvas | Race motion becomes background decoration | Track-first live layout; full-workspace planning on demand |
| Orders require knowledge of several control channels | Fear of unintended delegation or persistent micromanagement | Named, bounded radio calls with explicit scope and handback |
| Feedback emphasizes acceptance more than subsequent observation | Repeated commands or uncertainty about whether anything happened | One correlated receipt, then actual execution and observed resource changes |
| Long stretches of watching require manual speed management | Either boredom or missed changes | Explicit bounded watch with real fixed steps and automatic check-in |

These are heuristic findings. They do not establish how often real users encounter each issue. The retained Engineering layout makes a controlled comparison possible rather than forcing every established player onto the new composition.

## 3. Relevant precedents, without copying their assumptions

### Golden Lap: reduce presentation, not the importance of decisions

Funselektor and Strelka describe Golden Lap as a minimalist strategy game that exposes essential information, clarifies the meaning of decisions and removes micromanagement. That is a useful product direction: a smaller visible decision vocabulary can coexist with strategic consequences. It is marketing positioning, not evidence that any particular number of buttons is optimal. [S1]

**Applied here:** two persistent named driver cards; a compact live screen; four contextual race calls rather than an always-open engineering form. We do not copy era-specific mortality, budgeting or personality systems into a race-weekend patch. We also do not simplify physical pit execution into an instant effect.

### Motorsport Manager: preparation and adaptation both matter

The official store description connects practice and qualifying with race strategy and reacting to changing circumstances. This supports preserving the entire weekend rather than treating the race as a disconnected sequence of pop-up choices. [S2]

**Applied here:** practice remains an optional exchange of resources for information; qualifying remains a physical timed-lap process; grid and start remain explicit commitments. The redesign changes how players reach and understand these systems, not their existence.

### F1 Manager: revisit a consequential decision

Formula 1's official F1 Manager 2024 release describes its race-replay experiences. The useful pattern is revisiting a situation with a different decision. This is not evidence that the current game's forecast can predict that alternative accurately. [S3]

**Applied here:** preserve actual replay and separate sandboxes. The same new pit wall appears in an experiment, while the original result, resources and random state stay separate. Replay is a learning tool, not an automatic declaration that the alternative was better.

### Actual strategy: reacting immediately is not always the answer

McLaren's Spanish Grand Prix strategy debrief explains why reacting to a rival's stop was not necessarily the right whole-race choice. Palmer's Formula 1 analysis distinguishes undercutting, overcutting and running longer for a later offset; passing difficulty and the race situation matter. [S4, S5]

**Applied here:** “Keep orders & watch” is a first-class choice. A stop is not automatically labelled an improvement, and a push call does not promise a pass. Existing undercut/extension comparisons remain available. This increment does not claim to solve the previously documented shortage of robust extension-favourable fixtures.

## 4. What makes the loop worth learning

The PENS research summary links autonomy, competence and relatedness to motivation in play, including usable controls, understandable feedback and choices of strategy. We use autonomy and competence as design lenses: players should understand their authority and learn from observable consequences. This is not a claim that adding a decision card satisfies those needs for every player. [S6]

Adinolf and Türkay's study across four collectible card games warns against generalising a genre's player experience from one game. Its genre differs from this one, but the methodological caution is relevant: neither Golden Lap's positioning nor a generic motivation model substitutes for testing this game with its intended players. [S7]

The proposed loop is:

**Read the situation → choose a named intention or retain orders → confirm → watch real execution → inspect the outcome → revise the plan.**

This is neither a reaction-time game nor a spreadsheet with animated scenery. Important actions have costs and authority boundaries. Time can move between decisions without silently choosing them. The player is allowed to watch without continuously operating every resource slider.

Four questions should remain answerable at the live pit wall: Which phase am I in? What is happening to each driver? What deserves attention now? What can I do next? A deeper workspace answers the second layer: Why might this option work, what will it consume, who controls it, and what evidence supports the estimate?

## 5. Information architecture and visual hierarchy

NN/G's progressive-disclosure guidance recommends foregrounding primary work and making less frequent or advanced work accessible at a secondary level. Its warning matters too: the split needs user validation and should not become a maze of nested disclosure. [S8]

The implemented default has four destinations: **Pit wall, Race plan, Garage and Review**. **All tools** remains visible and searchable. It exposes the existing detailed destinations rather than maintaining a separate simplified copy of every form.

The live composition puts session, pause, speed and stage approval at the top; a contextual decision/watch strip below; classification and the circuit in the middle; and both named drivers below that. A dark graphite/brass treatment separates live command surfaces from the retained paper-style engineering workspaces. This is a deliberate two-context transition, not a claim that every game screen has been reskinned.

Driver identity remains spatially stable when the attention message changes. The interface can warn about Moreau without turning Mercer's open command into a Moreau command. Approximate gaps and fuel projections are labelled as estimates. Actual fuel on board is used during practice and qualifying instead of displaying a misleading race-finish projection. Qualifying cards show measured best laps, not a physical track gap that could be mistaken for a qualifying-time deficit.

A small radio line carries an actual recent event. Full race narrative and journals remain readable through Race story and All tools. The live screen does not try to display the complete event archive. Classification is allowed to scroll at compact enlarged text; the two owned drivers and their essential actions are not.

NN/G's recognition guidance favours visible contextual cues over remembering command names or a long tutorial. [S9] The new cards therefore name the action and its duration, while a resumable guide points to the actual controls. The guide does not pretend to replace phase-specific information.

## 6. The weekend as a sequence of different decisions

### Prepare and learn

The opening brief explains the job rather than exposing every subsystem at once. Optional practice opens the existing two-driver programme workspace. Each car retains its own objective, lap count, finite tyre set and setup draft. The result is measured information with real resource consumption, not an invisible setup-score boost.

The purpose is a meaningful preparation trade-off: learn more, or preserve stock and time. Skipping remains valid. Full engineering controls are not replaced with an invented “optimise car” button.

### Qualify

A driver can bank a timed lap or recall an active run. Release information states approximately how long a legal flying-lap start needs and the latest release time. It does not present that estimate as the active car's live ETA. Out-lap, flying lap, return and session closure remain physical.

Qualifying receipts must not block race commands later. A lifecycle test exposed exactly that defect in the first redesign: a retained qualifying receipt occupied the new race call surface. The repair scopes visible call receipts to their session phase while retaining authoritative history.

### Commit to the grid

The existing plan, starting tyre choices and pit ownership remain inspectable. Formation is not skipped and the lights are not approved by the watcher. The director stops its watch at the held grid before requesting the next approval. This is an inactive simulation phase: advancing frames does not move it, even though the underlying active-session pause flag is false. Tests check the held state itself rather than treating that flag as an approval.

### Race

The common call vocabulary is intentionally small: **push pace for two laps, protect tyres for two laps, save engine fuel for two laps, or box at the reviewed safe entry**. “Two laps” is two lap-distances under the existing temporary-intent model. Each radio call changes one channel and returns control afterwards; it is not a new physics bonus.

Pit calls pin the actual available replacement set, safe entry gate and forecast assumptions. The car must enter, travel, queue if necessary, receive service, fit the finite set and exit. An accepted order is not an already completed stop.

### Learn again

After acceptance, the call room becomes an execution/outcome view. It compares the original snapshot with current position, tread and onboard fuel, and identifies elapsed time. It explicitly does not attribute every change to that call. Traffic, weather and other orders also matter.

A completed session opens actual classifications and debrief. Existing notebooks and replay preserve facts separately from personal interpretation. Original-result acceptance remains explicit; no money, XP, points or campaign settlement is fabricated.

## 7. Pacing: watch a segment, not an invented highlight

The new **Next moment · 8×** control is opt-in. It runs the real simulation at a disclosed temporary speed, watching both drivers. It pauses on an observed material change or after a bounded quiet segment: three selected-car lap-distances, with a horizon of at most 180 simulated seconds. No distance, pit service or rival reaction is skipped.

Observed changes include phase transitions, retirement/finish, newly unusable tyres, tread thresholds, a newly negative race-fuel projection, observed water bands, flags, an approved pit window, physical pit progress, temporary-control handback, tactical status and a recorded qualifying lap. A routine position swap is not, by itself, a compulsory interruption.

Repeatedly resuming an already-known warning must not immediately re-pause forever. The watcher captures the starting state and detects transitions. Severe existing warnings remain visible, but do not create a zero-time resume loop.

The previous speed returns at a check-in. An explicit manual speed change cancels the watch and wins. Manual pause cancels it and restores the previous speed. Leaving the pit wall through the normal confirmed route stops the watch before saving. Ordinary browsing still does not pause: **Pause & decide** is explicitly named because it does.

XAG 108 supports separating adjustable assistance from broad difficulty settings and giving players control over pace; Game Accessibility Guidelines specifically recommends adjustable speed. [S10, S11] Our chosen watch duration is a design parameter, not a value prescribed by either source. XAG 116 concerns interface time limits and should not be misrepresented as forbidding all timed gameplay. [S12]

## 8. Trustworthy feedback and safe interaction

NN/G's system-status guidance stresses understandable feedback after input, including avoiding repeated activation caused by uncertainty. [S13] Here selection is not authorization. Confirmation names the driver. After acceptance, the commit action is no longer offered as though nothing happened.

A receipt is tied to a journal command, run or pit transaction. It can be accepted, executing, completed, cancelled, superseded or interrupted. A pit stop counter alone cannot prove that the reviewed stop completed. A tyre replacement during unrelated work cannot prove a fuel call succeeded. Truncated or unavailable evidence must remain distinguishable from a completed action.

A frozen review is valuable only when stale assumptions are rejected. Changed source revision, phase, unavailable stock or an expired forecast blocks confirmation and offers an explicit refresh. Selection elsewhere cannot retarget an already captured driver. Escape returns to the exact named driver action without sending the staged command.

The shallow UI is backed by the same deep constraints: owned sets, independent channel ownership, shared service, recorded commands and matching-model replay. Simpler presentation must not silently grant extra authority.

## 9. Accessibility, layout and technical approach

The required native profiles are 1440×900 and 1100×720 at 100%, 115% and 130% text. XAG text and contrast guidance informed readable labels and distinguishable interactive states. Godot's navigation and container documentation informed explicit focus restoration and container-based resizing. [S14–S17]

The compact design keeps named actions and confirmation footers outside scrolling evidence. It does not solve overflow by silently shrinking the selected text scale. The first compact run found a two-pixel card-boundary overflow; removing a nonessential footer on short viewports restored containment. The camera's fit padding is also smaller in the director layout so the circuit does not collapse into a tiny centre patch. Engineering and editor fit defaults remain unchanged.

The implementation adds small native presentation components: a read model, director/watcher, driver cards, call room, cached style helpers and a workspace composed over the existing weekend view. Existing analysis forms, practice programmes, classifications and sandbox mechanisms are reused. The inheritance seam is deliberately conservative; replacing all sporting and editor code would add migration risk without evidence that it addresses the reported dissatisfaction.

One fixed-step accumulator condition changed: when a watch pauses from a completed step, the current advance loop must stop consuming accumulated ticks immediately. Sporting coefficients, rival policies, forecast mathematics, checkpoint schemas and the versioned v10/v11 model identity are not rewritten.

## 10. Evaluation and limits

Automated coverage asks whether the interaction contracts hold: both drivers visible, essential labels fit, focus returns, choosing is observational, stale calls fail, a watch advances physical steps, manual control wins, actual stops fit the correct stock, handbacks occur and replay agrees. A separate native journey starts at briefing, records real practice and qualifying, approves formation/lights, finishes the race and branches a real checkpoint into a separate sandbox.

Three descriptive two-lap pace probes use the same Pinecrest seed and starting state. Protect, normal and push produce different tread costs. Push does not beat normal elapsed time in this traffic fixture. This negative finding is useful: the UI must not market a pace instruction as a guaranteed overtake. It is not a broad circuit/seed balance study.

The mandatory runner retains the previous domain corpus. New default-layout suites run first in the native group; the previous detailed-panel suites run against the selectable, shipping Engineering layout. They are not deleted or replaced with a mock. The old exact-class assertion is updated to accept the new composed workspace; its functional assertions remain.

For executed results, use `docs/race-director-verification.md` and the exact-head reports, not the baseline's counts. Repeated executions are not additional unique tests.

### Proposed human acceptance study — not yet executed

Recruit 6–8 participants spanning motorsport-management newcomers and experienced players. Counterbalance Engineering and Race Director with matched circuit, seed and starting stock. Do not teach the navigation before the first task. Ask participants to identify both drivers' main risks, bank a qualifying lap, keep an existing plan deliberately, issue a bounded saving call, explain who regains control, order a physical stop and inspect a result without claiming causation.

Record task completion, wrong-driver actions, unintended orders, time to find the action, interventions per race segment, time looking away from the circuit, confidence about command state and explanations of the trade-off. After play, ask about agency, pacing, tension and whether the race felt like their decisions mattered. A faster task is not necessarily a better strategic experience.

Proposed gates are zero unnoticed wrong-driver or duplicate orders, at least 90% successful essential tasks after one guided attempt, and accurate explanation of watch versus delegation. Those are acceptance targets, not achieved statistics. Check whether three-lap quiet segments feel too passive, whether pit-stage pauses are too frequent and whether experts miss simultaneous telemetry. Keep the Engineering option while those questions remain open.

Windows/exported launch, actual DPI, controller hardware, screen readers, larger text scales, representative-device latency and wider strategic balance remain independent gates. Existing historical-loop progression and campaign settlement are outside this race-weekend redesign.

## Sources and evidence register

All accessed 26 September 2026. These are primary institutional, author, developer or team sources; source claims and our implementation choices are separated above.

- **S1 — Funselektor / Strelka:** [Golden Lap, official developer description](https://store.steampowered.com/app/2052040/). Product positioning, not measured usability.
- **S2 — Playsport / SEGA:** [Motorsport Manager, official developer description](https://store.steampowered.com/app/415200/Motorsport_Manager/). Weekend structure and strategy scope.
- **S3 — Formula 1:** [F1 Manager 2024 release](https://corp.formula1.com/f1-manager-2024-out-now-with-new-create-a-team-mode/). Official feature description. Direct Frontier feature-page access was unavailable; no unseen page details are asserted.
- **S4 — McLaren Racing:** [Spanish Grand Prix strategy debrief](https://www.mclaren.com/racing/formula-1/2025/spanish-grand-prix/strategy-debrief/). A team's explanation of a particular race, not a universal optimum.
- **S5 — Formula 1 / Jolyon Palmer:** [Singapore and the art of undercutting](https://www.formula1.com/en/latest/article/jolyon-palmers-analysis-singapore-and-the-art-of-undercutting.1NgVyVsZnHTDEA9wi0s5lW). Context-dependent pit tactics.
- **S6 — Self-Determination Theory authors:** [Player Experience of Needs Satisfaction](https://selfdeterminationtheory.org/player-experience-of-needs-satisfaction-pens/). Motivation research summary.
- **S7 — Adinolf and Türkay:** [Differences in Player Experiences of Need Satisfaction Across Four Games](https://dl.digra.org/index.php/dl/article/view/1093), DiGRA 2019. Limits of genre-level generalisation.
- **S8 — NN/G:** [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/).
- **S9 — NN/G:** [Memory Recognition and Recall in User Interfaces](https://www.nngroup.com/articles/recognition-and-recall/).
- **S10 — Microsoft:** [XAG 108, difficulty and assistance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/108).
- **S11 — Game Accessibility Guidelines:** [Adjustable game speed](https://gameaccessibilityguidelines.com/include-an-option-to-adjust-the-game-speed/).
- **S12 — Microsoft:** [XAG 116, time limits](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/116).
- **S13 — NN/G:** [Visibility of System Status](https://www.nngroup.com/articles/visibility-system-status/).
- **S14 — Microsoft:** [XAG 101, text display](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/101).
- **S15 — Microsoft:** [XAG 102, contrast](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/102).
- **S16 — Godot:** [Keyboard/controller navigation and focus](https://docs.godotengine.org/en/stable/tutorials/ui/gui_navigation.html).
- **S17 — Godot:** [Using containers](https://docs.godotengine.org/en/stable/tutorials/ui/gui_containers.html).
- **S18 — Game Accessibility Guidelines:** [Reminders of current objectives](https://gameaccessibilityguidelines.com/indicate-allow-reminder-of-current-objectives-during-gameplay/). Supports recoverable phase purpose, not compulsory tutorial interruptions.

The external sources ground design choices. They do not validate the fun, balance or accessibility of this specific implementation.
