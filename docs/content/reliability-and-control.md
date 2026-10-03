# Reliability, incidents and race-control authoring

`race_tuning/*.json` now accepts a complete optional `operations` object with
`model: race-operations-v1`. It configures the **existing aggregate-condition
model, driving-error exposure and fictional virtual neutralization**, not a
physical safety car, a real-series rulebook or an itemized mechanical simulation.
All numbers are game coefficients requiring balance tests, not measured real-world
failure probabilities. Algorithms, legal command authority and RNG stay in code.

## External editing

Copy `content/examples/club-racing` outside the installation. In
`race_tuning/sprint.json`, edit an operations field, validate the pack, and launch
a new weekend with the existing Club Sprint preset:

```sh
python3 scripts/content.py validate ./club-racing --godot /path/to/godot
python3 scripts/content.py inspect ./club-racing --id local.club.race_tuning.sprint --godot /path/to/godot
```

For example, `control.virtual_pace_factor: 0.45` and `control.ending_seconds: 11`
configure a 45-percent reference-speed target and an eleven-second ending period.
The cap is a target reached through normal braking; it does not accelerate slower
cars, bunch the field, teleport a driver or waive no-passing. Runtime, forecasts
and the rule explanation consume the same frozen calibration. New global hazards
still cancel ending, and pending hazards activate before the next field snapshot.

`reliability.fault_threshold_base: 200` and `fault_threshold_span: 0` use a fixed
sampled stress threshold while retaining its random draw. This does not remove
the separate terminal critical-exposure threshold or zero-health retirement.
Driver remaining health is lifetime state and is never replenished by pit repair.

## Definitions, private state and permissions

Every new session freezes its operations inside `RaceTuningDefinition`. Saved
native state, replays and result identity retain those exact definitions; changing
or deleting the source pack affects future sessions only. A pre-extension v1 record
without `operations` keeps its record and fingerprint unchanged and resolves the
immutable `LegacyOperations` bundle. Installed mutable core data is never used to
reinterpret an old save. Supplying `operations` explicitly requires all fields;
partial defaults, unknown behavior names and unused keys are rejected.

Fault and terminal thresholds are private **sampled state**, not another authoring
interface. Save decoding validates them against the frozen threshold ranges rather
than the old hardcoded 25–50 / 35–70 ranges. The public recovery comparison receives
only observed damage, health, temperature, modes, location and stage. It cannot
read private random state, future weather or the time remaining to a sampled fault.
The material forecast key already includes authored tuning identity.

The initial repair-work budget is configurable, but player emergency authority
still starts at **advice only**. An automated repair needs explicit per-driver
permission, delegated pit ownership, a feasible physical gate and sufficient work
budget. An approved plan that forbids emergencies remains binding. Changing a
threshold cannot create tyres, bypass a puncture, overrule manual control or pause
the race. Calm mode still disables stochastic driving errors and faults; it does
not grant immunity from wear or zero-health exhaustion.

Repair-only work uses `service.repair_seconds_per_damage` from the shared tuning
record for both displayed repair work and actual service receipts. It retains the
fitted set and condition, does not redraw fault thresholds, and cannot restore
lifetime health. Recovery debriefs use the current player IDs, including reordered
rosters, rather than historical player slots 3 and 6.

## Validation and compatibility

The production validator requires finite numbers, correct types and bounds from
`OperationsTuningSchema`. Damage stage thresholds ascend; health thresholds descend;
warning reset temperatures do not exceed warning entry temperatures; saving,
normal and attacking exposure factors are ordered. Threshold base-plus-span and
incident damage/time-loss combinations fit the protected state bounds. Worst-case
combined driving exposure must not exceed probability one per fixed step.

Hard limits remain engine-owned: 0.05-second steps, separate RNG algorithms/streams,
state bounds, command repair-work ceiling, no-passing geometry, three control
sectors, pending-queue limits and serialized service limits. These are not privileges
a content pack can expand. Explicit high damage in the legacy incident path is
now saturated at the existing 1000-unit save bound; this is an intentional safety
correction for exceptional inputs, not a change to default ordinary incidents.

Old executables do not understand the optional object and may reject it. Forward
loading is not promised. New meanings or new executable procedures require a new
versioned model; a new instance of this supported model needs only data.

## Evidence and regression commands

`tests/fixtures/operations-v1-characterization.json` was captured on pre-extraction
commit `177aa7911fbf0c614ec0885ab770cd436673dea4` in the pinned engine. It fixes the
original 250-second condition trajectory, fault outcomes/random streams, and
control transitions and public wording. Do not regenerate it to make a failed
refactor pass. The content suite also covers non-legacy thresholds, rejection,
immutable continuation, actual repair-service hooks, query consistency and roster
ownership. The retained recovery suite exercises complete physical pit travel.

```sh
python3 scripts/verify.py --godot /path/to/godot --suite content_operations_tests --suite recovery_tests --suite architecture_characterization
python3 scripts/verify_content_export.py --godot /path/to/godot
```

The export verifier loads file-edited operation parameters and their sampled
thresholds in real Linux debug/release executables, rejects a conflicting stage
order and restores the same session after deleting the source pack. It does not
constitute Windows execution, human playtesting or proof of enjoyable balance.

## Field reference

Every field below is required when `operations` is present. Nested paths start
at `/operations`. Names, ranges and documentation are projected into the generated
race-tuning JSON Schema from the executable schema contract.

### `reliability`

| Field | Default | Allowed range | Unit and meaning |
|---|---:|---:|---|
| `damage_warning` | 5 | 0–1000 | damage units: Inclusive warning threshold. |
| `damage_degraded` | 20 | 0–1000 | damage units: Inclusive degraded threshold, not below warning. |
| `damage_critical` | 55 | 0.01–1000 | damage units: Inclusive critical threshold, not below degraded. |
| `health_warning` | 80 | 0–100 | health percent: Inclusive warning threshold. |
| `health_degraded` | 60 | 0–100 | health percent: Inclusive degraded threshold, not above warning. |
| `health_critical` | 25 | 0–100 | health percent: Inclusive critical threshold, not above degraded. |
| `temperature_warning_c` | 114 | 0–200 | Celsius: Start a thermal warning. |
| `temperature_warning_reset_c` | 110 | 0–200 | Celsius: Retain an existing thermal warning down to this temperature. |
| `stress_warning` | 12 | 0–10000 | exposure units: Warning threshold for accumulated repairable stress. |
| `thermal_reference_c` | 108 | 0–200 | Celsius: No thermal exposure below this temperature. |
| `thermal_exposure` | 0.08 | 0–1 | exposure/second/Celsius: Thermal exposure above the reference. |
| `health_reference` | 80 | 0–100 | health percent: No condition exposure above this health. |
| `health_exposure` | 0.007 | 0–1 | exposure/second/health point: Condition exposure below the reference. |
| `damage_reference` | 15 | 0–1000 | damage units: No damage exposure below this value. |
| `damage_exposure` | 0.013 | 0–1 | exposure/second/damage unit: Exposure above the reference. |
| `maximum_exposure` | 6 | 0.01–50 | exposure/second: Clamp after engine-mode scaling. |
| `engine_save` | 0.4 | 0–10 | multiplier: Exposure in saving engine mode. |
| `engine_normal` | 1 | 0–10 | multiplier: Exposure in normal engine mode. |
| `engine_attack` | 1.5 | 0–10 | multiplier: Exposure in attack engine mode. |
| `stress_recovery_per_second` | 0.2 | 0–50 | exposure/second: Stress recovery when instantaneous exposure is zero. |
| `fault_threshold_base` | 25 | 0.01–10000 | exposure units: Minimum sampled fault threshold. |
| `fault_threshold_span` | 25 | 0–10000 | exposure units: Uniform threshold jitter; the random draw remains when zero. |
| `terminal_threshold_base` | 35 | 0.01–10000 | critical exposure units: Minimum sampled terminal threshold. |
| `terminal_threshold_span` | 35 | 0–10000 | critical exposure units: Uniform terminal-threshold jitter. |
| `fault_damage_base` | 6 | 0–1000 | damage units: Base scalar damage added by a fault. |
| `fault_damage_span` | 8 | 0–1000 | damage units: Uniform additional scalar-fault damage. |
| `fault_health_base` | 1 | 0–100 | health points: Base lifetime health lost to a fault; never repaired in pits. |
| `fault_health_span` | 2 | 0–100 | health points: Uniform additional lifetime health loss. |
| `minimum_critical_exposure` | 0.02 | 0–50 | exposure/second: Minimum accumulation while critically damaged. |
| `critical_recovery_per_second` | 0.2 | 0–50 | exposure/second: Critical-load recovery outside the critical stage. |
| `minimum_critical_seconds` | 15 | 0.05–600 | seconds: Minimum critical interval before progressive terminal failure; zero health is separate. |
| `observed_rising_exposure` | 0.1 | 0–50 | exposure/second: Public rising-exposure label threshold; not a failure prediction. |
| `default_repair_budget_seconds` | 12 | 0–30 | seconds of additional repair work: Initial per-driver cap; does not grant player repair authority. |
| `repair_minimum_tread` | 10 | 0–100 | tread percent: Minimum limiting-wheel life for repair-only service; punctures remain disallowed. |

### `control`

| Field | Default | Allowed range | Unit and meaning |
|---|---:|---:|---|
| `virtual_pace_factor` | 0.6 | 0.05–1 | multiplier: Virtual/ending target relative to the compiled speed envelope; no catch-up. |
| `ending_seconds` | 8 | 1–120 | seconds: Published no-passing interval after virtual clearance. |
| `local_yellow_speed_mps` | 25 | 1–100 | metres/second: Local-yellow target speed cap; ordinary braking still applies. |
| `legacy_neutral_speed_mps` | 30 | 1–100 | metres/second: Legacy neutral/formation target cap; not a physical safety car. |
| `local_incident_seconds` | 18 | 1–120 | seconds: Local clearance for a non-terminal driving incident. |
| `retired_car_seconds` | 38 | 1–120 | seconds: Global virtual clearance for an actual on-track retirement. |
| `legacy_mechanical_seconds` | 22 | 1–120 | seconds: Legacy mechanical-retirement local-yellow interval. |

### `incidents`

| Field | Default | Allowed range | Unit and meaning |
|---|---:|---:|---|
| `base_exposure_per_second` | 1.8e-05 | 0–0.001 | per simulated second: Base driving-error exposure before driver, tyre and mode factors. |
| `consistency_factor` | 0.055 | 0–0.2 | multiplier/consistency deficit point: Driving-error exposure below consistency 100. |
| `reliability_factor` | 0.015 | 0–0.2 | multiplier/reliability deficit point: Driving-error exposure below reliability 100. |
| `push_factor` | 1.5 | 1–5 | multiplier: Driving-error exposure at push pace. |
| `water_factor` | 3.5 | 0–10 | multiplier/water fraction: Exposure on the actual local strip. |
| `low_tread_reference` | 25 | 0–100 | tread percent: Reference below which driving-error exposure rises. |
| `low_tread_factor` | 0.06 | 0–0.2 | multiplier/tread point: Exposure below the low-tread reference. |
| `patient_factor` | 0.9 | 0–5 | multiplier: Driving-error exposure under patient racecraft. |
| `balanced_factor` | 1 | 0–5 | multiplier: Driving-error exposure under balanced racecraft. |
| `assertive_factor` | 1.12 | 0–5 | multiplier: Driving-error exposure under assertive racecraft. |
| `volatile_factor` | 2.2 | 1–5 | multiplier: Disclosed volatile mode; calm still suppresses stochastic incidents. |
| `barrier_probability` | 0.08 | 0–1 | conditional probability: Barrier retirement after a driving error has occurred. |
| `legacy_retirement_threshold` | 0.18 | 0–1 | cumulative conditional probability: Legacy mechanical branch follows barrier outcomes. |
| `legacy_mechanical_health` | 95 | 0–100 | health percent: Legacy mechanical branch only below this remaining health. |
| `lost_seconds_base` | 3 | 0–120 | seconds: Base time loss after a non-terminal driving error. |
| `lost_seconds_span` | 7 | 0–120 | seconds: Uniform additional driving-error time loss. |
| `damage_base` | 4 | 0–1000 | damage units: Base damage after a non-terminal driving error. |
| `damage_span` | 10 | 0–1000 | damage units: Uniform additional driving-error damage. |
| `tread_loss` | 5 | 0–100 | tread points: Per-wheel retained-life loss from a driving error. |
