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
