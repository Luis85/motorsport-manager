# Race Weekend UI overhaul

The native pit wall follows the approved green/cream/brass design direction: race state first, timing and circuit for observation, two persistent driver cards, and contextual analysis. The visual boards are not authoritative specifications for extra sporting rules or unsupported simulation data.

## Current implementation

The production stack remains `WeekendView → StrategyWeekendView → WeatherWeekendView → RecoveryWeekendView → PitwallWorkspace → PracticeWeekendView`. It hosts real Strategy, Car, Team, Conditions and Review surfaces. Wide Race view uses a right-hand two-car rail; compact/analysis views retain both cards below the circuit. The original command boundary, finite inventories, staged setup and player-controlled time remain unchanged.

The earlier cumulative implementation notes overstated completion of the architectural plan. See the [increment-by-increment implementation audit](ui/race-weekend/implementation-status.md) for delivered behavior, repaired defects and remaining work. See the [verification protocol](ui/race-weekend/verification-repair.md) for exact methods and evidence limits.

## Interaction contracts

- Observation, selection, comparison and draft editing never issue race commands.
- Both driver identities and their primary actions remain explicit.
- Keep plan uses the existing domain acknowledgement and does not silently change ownership.
- Accepted and rejected commands receive recoverable feedback.
- Important data is labeled measured, estimated or unavailable; independent weather cases are not drawn as a future timeline.
- Session Results does not declare a final winner during live running or invent missing practice/qualifying evidence.
- Keyboard focus, text scaling and responsive layout are native behavior, not inferred from a static mockup.

The full plan is not considered finished merely because its panel names exist. Native testing, authored visual refinement, additional component extraction, and user playtesting are separate completion gates.
