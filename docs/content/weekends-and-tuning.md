# Named weekends and shared race tuning

## Authoring outcome

A `weekend` record selects the existing practice-to-results journey, not an
executable phase graph or a different sporting discipline. It references vehicle,
roster, tyre allocation, setup and shared race-tuning records by stable ID. Its
settings select lap count, seed, qualifying duration, weather scenario, incident
intensity, seeded/scripted-training weather, rival styles and tactical duels.
Unknown references, unsupported modes, wrong Boolean types and unknown fields
are rejected before replacing a working catalog.

`core.weekend.standard` and `core.weekend.quick` preserve the current 24/12-lap
choices. Both use the same uncompressed reference model. The example
`local.club.weekend.sprint` is a deliberately different **game tuning** example:
eight laps, fourteen entrants, six compounds, ten sets per driver, a distinct car
and setup, a larger fuel reserve and six-second tyre service. It is not calibrated
real motorsport physics or a promise of competitive balance.

## Edit externally

Copy `content/examples/club-racing` to an external folder. Edit
`weekends/sprint.json` and `race_tuning/sprint.json`, validate, then launch the
unchanged application with `-- --content-pack=/absolute/path/to/club-racing`.
Select **Club sprint weekend** in the existing **WEEKEND** setup control. Selecting
it stages settings only; **Review weekend** and **Start practice** retain the normal
approval and initial-save sequence. The selected circuit still needs a suitable
grid and pit capacity for the selected roster. The application does not silently
expand your circuit to fit an invalid entry.

The setup screen also permits independent field, car, allocation, setup and race
model choices. Changing a preset's settings creates an effective session-specific
copy of its configuration; the source file is not overwritten. **Custom selection**
leaves the current values available for manual editing rather than unexpectedly
resetting them. The minimal shipping pitwall is unchanged.

```sh
python3 scripts/content.py clone core.race_tuning.default \
  --as local.club.race_tuning.my_model --pack ./club-racing --godot /path/to/godot
python3 scripts/content.py clone core.weekend.quick \
  --as local.club.weekend.my_event --pack ./club-racing --godot /path/to/godot
python3 scripts/content.py validate ./club-racing --godot /path/to/godot
python3 scripts/content.py inspect ./club-racing \
  --id local.club.weekend.my_event --godot /path/to/godot
```

After cloning, edit the new weekend's references to choose your new tuning and
other records. Filenames and display labels are not identities. Validation and
inspection use the same production Godot content compiler as the application.

## Supported tuning

The authoritative fields and ranges are in `RaceTuningSchema`; the generated
`race_tuning.schema.json` supports external editors. The documented
[field reference](race-tuning-fields.md) describes the implemented consumer for
each field. Mode arrays contain exactly three entries in the existing order:
conserve/balanced/push for pace and save/standard/attack for engine settings.
Coefficients cannot add a fourth control or execute code.

Fuel is measured in **lap-equivalent units**, not litres. Runtime and forecasts
share fuel rates and reserves. Service forecasts derive the expected base and
jitter from the same inputs as physical pit work. Forecast-only allowances and
its coarse fuel-mass approximation are explicitly named; an estimate is not a
promise of the exact visit or race result. Runtime still consumes its original
random draw when a service jitter is set to zero, preserving draw order.

Semantic validation additionally rejects configurations whose maximum race load
exceeds the existing 200-unit save bound, whose worst repair duration exceeds
200 seconds at the supported 1,000-damage limit, or whose engine-temperature
endpoints leave the supported 0–200°C range. Pace/engine/wear arrays must be
nondecreasing. The 200 m/s runtime speed ceiling and other serialization/safety
limits remain engine-owned, not content-pack privileges. Such extreme bounds
are safety constraints, not recommended or calibrated balance values.

## Save and replay behavior

A new authored session freezes its complete selected tuning and effective weekend
record together with the previously frozen car, roster, allocation and setup.
The dependency records, not just filenames or hashes, are included. References
and effective mode choices are checked during restore. Replay identity includes
both records, so changing endpoint tuning and recomputing an envelope digest does
not authorize changing the rules midway through a replay.

Editing or deleting the external source affects future sessions, not a saved or
running one. An invalid reload retains the previous valid catalog. Old saves and
direct legacy construction keep `LegacyRaceTuning` values and their old metadata
shape. Mutable entrant records still contain exactly 91 fields; tuning belongs
to the session rather than being duplicated into every car.

## Verification and limits

`content_tuning_tests` covers production pack loading, schema/reference rejection,
legacy numerical equivalence, shared runtime/forecast inputs, service RNG and
receipt validation, real launch/approval, and frozen save/replay continuation.
`content_weekend_ui_tests` drives the native preset selector with keyboard input,
checks configuration-only staging, and launches practice at 1440×900 and
1100×720 with enlarged text. These are automated interaction tests, not human
usability or accessibility certification.

`verify_content_export.py` runs both Linux debug/release executables from isolated,
non-writable installations with a Unicode/space external-pack path. It changes
vehicle, compound, setup, tuning and weekend values without rebuilding, rejects
invalid content, removes the pack, and requires exact saved-session restoration.
Other platforms require separate execution evidence.

The subsequent content migrations implemented authored weather/surface,
reliability/control, AI/racecraft, wheel operating coefficients, supported circuit
styles and registered-provider selection. See the family guides below and the
[consumer inventory](consumer-inventory.md) for their exact fields and owners.
Structural and safety bounds, executable mechanics, command permissions and
simulation algorithms remain code-owned; authored values cannot relax them.

## Weather and surface extension

The optional frozen `environment` object is now supported. Its complete field
reference, compatibility policy and unchanged safety boundaries are described in
[Weather and surface authoring](weather-and-surface.md).

Supported reliability, incident and virtual-control coefficients are documented in
[reliability and control](reliability-and-control.md). Registered-provider selection
is described in [mechanic profiles](mechanic-profiles.md), AI/racecraft tuning in
[competition and AI](competition-and-ai.md), wheel coefficients in
[tyres and setup](tyres-and-setup.md), and supported circuit styles in
[circuits and scenarios](circuits-and-scenarios.md). New executable provider
implementations still require code registration, versioned readers and regression
checks.
