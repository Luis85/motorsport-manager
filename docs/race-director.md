# Race Director — native behavior and compatibility

Application **0.16.0**. This is a new default presentation and interaction rhythm, not a second race engine. Read [the research and audit](design/race-director-research.md) for the design rationale and [verification](race-director-verification.md) for evidence boundaries.

## Play

Import `project.godot` with Godot 4.7.2 Standard and press F5. Start a Grand Prix Weekend. **Pit wall** shows the circuit, classification, both named drivers and a contextual situation. **Race plan**, **Garage** and **Review** open existing detailed workspaces. **All tools / Ctrl+K** provides the full catalog, including weather, recovery, tactics, telemetry, replay and notebook.

Optional practice opens the two-driver programme dashboard. Choose real objectives, stock and lap counts; explicitly start and release each run. Qualifying driver calls expose a banker run and recall. Qualifying, preparation, formation and lights still require their own approvals.

In a live race, **Pause & decide** pauses before capturing the named driver. The paused label becomes **Decide**. Choosing an option does not issue it. Confirmation names the driver; a selection elsewhere cannot retarget it. The common options are two-lap pace push, tyre protection, engine fuel saving and a forecast-pinned physical pit stop. Full strategy and ownership remain accessible.

**Keep orders & watch** sends no car command. **Watch it unfold · 8×** returns from an accepted call to the circuit. Both use the explicit bounded watcher. Existing engineers, pit orders and unrelated control channels remain intact.

After a call, the same room shows the correlated receipt and actual observations since the acceptance snapshot. Reopening retains that original snapshot rather than disguising it as a new comparison. A different session clears the visible call receipt, not its journal history. Refresh situation deliberately starts a fresh review; duplicate activation cannot resubmit an accepted call.

## Watch contract

`RaceMomentDirector` attaches to the existing model's fixed-step and accepted-input signals. It is unarmed until the player requests **Next moment · 8×** or a labelled watch action. It temporarily uses 8×, then stops at an observed material change or a quiet segment bounded by three selected-car lap-distances and `clamp(track.estimate * 3.5, 90, 180)` simulated seconds.

The watcher observes both owned cars, public flags and observed surface water. It does not inspect private rival resources, future weather or hidden plans. It does not generate an incident, choose a strategy, approve a phase or skip any physical step. Quiet check-ins and recorded events are not invented race highlights.

On a check-in, an active session pauses and its previous speed returns. An inactive boundary such as `grid_ready` is held by phase, not by the active-session pause flag. Manual speed wins and cancels watching. Manual pause cancels watching and restores its prior speed. Switching to Engineering or confirming exit stops the watch before ordinary save behavior.

The live moment history retains 24 entries; the reader discloses dropped older entries. It is presentation state, not the complete journal. A loaded save does not restore an armed watcher. Actual speed/pause inputs continue through the normal recorded command boundary.

## Presentation and accessibility

The default layout uses the new native dark live/call surfaces and the existing paper-style full engineering workspaces. At compact enlarged text, a nonessential shortcut footer is hidden rather than shrinking the requested font scale. Both owned-driver controls and call confirmation actions remain fixed. Classification and long evidence may scroll. The director's fit padding is smaller; editor and Engineering defaults are unchanged.

Escape closes a call without sending it and restores the exact driver action. All tools has a visible return target. The new `race director` tutorial has independent saved progress; the original `pit wall` guide remains available in Engineering. Ordinary browsing and guides do not pause automatically.

Settings stores `pitwall_layout` as `director` or `engineering`; invalid values fall back to `director`. **Weekend → Switch pit-wall layout** changes and saves that preference. The public `-- --pitwall-layout=director|engineering` launch override does not itself save settings.

## Architecture

- `race_director_workspace.gd`: composes the default layout over `PracticeWeekendView`, reusing its actual forms, commands and drafts.
- `director_read_model.gd`: observational phase/driver summaries.
- `moment_director.gd`: opt-in fixed-step pacing, with no race-order authority.
- `director_car_card.gd`: stable named-driver actions and concise state.
- `call_room.gd`: captured review, explicit authorization, correlated receipt and observed follow-through.
- `director_style.gd`: cached native style resources, without global editor theme replacement.

The existing `RaceDecisionViewModel` adds physical qualifying-recall receipt handling. `RaceSim.advance` stops its accumulator loop immediately after a completed step pauses the session; it does not consume the rest of that frame's pending ticks while paused. No sporting coefficient, rival policy or forecast calculation changes.

Application version is distinct from sporting compatibility. Existing checkpoint v10/v11, replay/session envelopes and matching-model continuation remain. New and resumed original weekends and sandbox views use the selected layout. Result acceptance, original/sandbox save isolation, finite stock and physical shared-box service remain authoritative. There are no new rewards, campaign settlement, driver-pressure model, arbitrary car components or forced tactical victories.
