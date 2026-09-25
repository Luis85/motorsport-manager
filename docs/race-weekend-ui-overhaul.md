# Race Weekend UI overhaul

This implementation translates the approved high-fidelity concept board into the native Godot pit wall.

## Interaction hierarchy

1. **Race state first.** Circuit/session, clock, flag, weather and time controls live in dark racing-green session strips.
2. **Observe by default.** The circuit remains the largest workspace. The always-on telemetry graph is removed from the watch state; telemetry remains available contextually.
3. **Two-car awareness.** Existing teammate selectors and persistent driver resources remain on the right pit wall.
4. **Decision queue.** A new bottom strip surfaces only material tyre, fuel, condition or active-pit-plan situations. Review opens relevant detail; Keep plan explicitly acknowledges deliberate inaction.
5. **Context on demand.** Drive, Tyres, Setup, Telemetry, Radio and Surface remain available without crowding the default race view.

## Visual system

The race weekend uses deep racing green for structural chrome, cream for decision surfaces, brass/gold for selection and primary actions, green for healthy state, and red only for danger. The rest of the application keeps the established paper/green/brass identity.

## Interaction principles

- Watching is a valid player action.
- Selection and inspection never issue commands.
- No alert automatically pauses or changes simulation speed.
- Primary race actions stay reachable while inspecting detail.
- Important state uses text/symbols in addition to color.
- Decision copy explains the trigger and leaves the current plan intact unless the player explicitly commits a change.
- Existing domain state, race commands, persistence and deterministic simulation are unchanged by this UI pass.

## Acceptance focus

- 1440×900 primary target and existing 1100×720 minimum remain supported.
- Both player cars and primary pit actions remain reachable without horizontal scrolling.
- The circuit receives more vertical space in the default watch state.
- No live telemetry refresh rebuilds stable controls.
- Decision queue derives only from existing authoritative race state; it does not invent forecast outcomes.

## Polishing pass

The follow-up pass tightened the implementation rather than adding race mechanics:

- Decision prompts now carry explicit CAR / TYRE / FUEL / PIT / CLEAR status text in addition to color.
- Keep plan suppresses an acknowledged prompt until the underlying state crosses a new material band; it no longer repeats the same issue every refresh.
- Review routes to the relevant contextual surface instead of always opening tyres.
- Telemetry visualization appears only when Telemetry is intentionally opened and disappears again in Watch mode.
- The timing tower now shares the dark race chrome and uses a high-contrast selected row, while player cars remain distinguishable without relying on color alone.
- Race buttons now have explicit keyboard-focus and pressed states matching the gold interaction accent.
- The decision system remains presentation-only and consumes no race RNG or hidden future state.

## Concept-alignment pass

A second polishing pass closes additional gaps to the approved high-fidelity boards:

- The selected-driver surface now reads as a compact race card: large position, driver identity, nearest-rival context, current intent, compound/condition, fuel margin and pit-plan state.
- Strategy weekends use two equal cream driver/decision cards as the persistent team layer, matching the two-car pit-wall concept rather than a generic notification strip.
- The two-card area now carries a persistent team summary with both positions and shared-box coordination state.
- High-priority strategy cards gain a restrained danger border/surface treatment without changing simulation time or issuing a command.
- The live classification, circuit, two-car strategy cards and contextual inspector now form the primary four-part race hierarchy from the concept board.
- Deep strategy, telemetry, weather, team orders and debrief remain progressive-disclosure surfaces instead of competing with the circuit by default.

## Deep review and refinement pass

The implementation was reviewed against the approved master race view, decision-drawer and two-car pit-wall concepts. The largest remaining mismatch was not missing functionality but too much simultaneously visible secondary control. This pass therefore reduces chrome while retaining every existing capability.

### Findings addressed

- The session bar had drifted back toward an application toolbar. Save, export, guide and menu are now grouped under one Weekend menu so lap/flag/weather/time information carries the visual weight.
- The race context strip now exposes measured surface water and rubber beside the existing weather state, keeping the top bar focused on information that can change a call.
- Driver resource bars now reinforce low tyre, fuel and integrity states with redundant text/color treatment rather than remaining visually neutral.
- Strategy cards previously exposed up to seven actions at once. They now privilege Compare, Box/Release and Keep plan; low-frequency fuel/cancel operations move under More.
- Contextual button labels describe the actual next action: Box this lap / Box lap N, Compare details, Release now.
- The two-car cards remain persistent and symmetric; deep analysis stays in the inspector. No capability was removed.

### Review conclusion

The live race now more closely follows the intended interaction rhythm: read the track and classification, scan both cars, react only when a decision becomes material, inspect evidence when needed, then commit one clear action. Secondary application commands and low-frequency race controls no longer compete with this loop.
