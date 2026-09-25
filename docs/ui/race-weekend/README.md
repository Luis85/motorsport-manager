# Race Weekend UI contract

The high-fidelity race-weekend board is the presentation contract for the native Godot pit wall. The implementation keeps the existing simulation authoritative and changes only presentation, navigation and command disclosure.

## Hierarchy

1. Session state: event, phase, lap/time, flag, weather/surface and time controls.
2. Observation: classification and circuit.
3. Team: two persistent driver cards.
4. Attention: decision feed/queue.
5. Context: strategy, tyres, telemetry, weather, team, setup, radio, surface and debrief.

The normal race state is for watching and understanding. Deep controls appear on demand. Selection and inspection never issue a command.

## Screen contracts

- Race: timing + circuit + two cars + decision feed.
- Qualifying: best/delta/run state/traffic + circuit + release controls.
- Practice: programmes, measured evidence and feedback.
- Strategy: compare / plan / control with uncertain ranges.
- Telemetry: measured metrics, speed trace, sectors and lap history.
- Weather: observed rain, measured water, uncertain outlook and stress cases.
- Team: cooperation, battles and shared pit box.
- Radio: chronological recoverable event stream.
- Setup: staged changes with explicit Apply semantics.
- Results: authoritative classification and measured evidence.
