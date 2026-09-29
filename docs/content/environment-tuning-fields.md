# Weather, surface and limited-information forecast parameters

These optional v1 race-tuning groups are expanded from immutable pre-extraction defaults when absent. New core records write every value explicitly. Omitting a group preserves older authored saves; a present group must be complete and cannot contain unknown fields. A snapshot retains the original record and its identity, not a link to a mutable source file.

All coefficients below are game-model tuning, not calibrated fluid physics or probabilities. Spatial resolution (96 × 7), fixed-step sampling, conservation clamps, numerical integration, RNG algorithm, and hard state-size limits remain engine contracts.

## `weather`

| Field | Default | Range | Unit |
|---|---:|---:|---|
| `wet_initial_cloud` | 0.94 | 0–1 | normalized cloud |
| `changeable_initial_cloud` | 0.32 | 0–1 | normalized cloud |
| `changeable_initial_span` | 0.3 | 0–1 | normalized cloud |
| `dry_initial_cloud` | 0.18 | 0–1 | normalized cloud |
| `wet_initial_rain` | 0.65 | 0–1 | normalized rain |
| `dry_target_base` | 0.12 | 0–1 | normalized cloud |
| `dry_target_span` | 0.28 | 0–1 | normalized cloud |
| `wet_target_base` | 0.28 | 0–1 | normalized cloud |
| `wet_target_span` | 0.72 | 0–1 | normalized cloud |
| `changeable_target_base` | 0.05 | 0–1 | normalized cloud |
| `changeable_target_span` | 0.95 | 0–1 | normalized cloud |
| `target_base_seconds` | 45 | 5–500 | seconds |
| `target_jitter_seconds` | 100 | 0–500 | seconds |
| `cloud_response_per_second` | 0.005 | 0–1 | cloud / second |
| `rain_cloud_threshold` | 0.52 | 0–1 | normalized cloud |
| `rain_cloud_gain` | 2.5 | 0.01–10 | rain / cloud |
| `rain_response_per_second` | 0.008 | 0–1 | rain / second |
| `observation_interval_seconds` | 10 | 1–60 | seconds |
| `wet_initial_water` | 0.6 | 0–1 | normalized water |
| `dry_initial_water` | 0 | 0–1 | normalized water |
| `initial_rubber` | 0.12 | 0–1 | normalized rubber |
| `training_wet_rain` | 0.65 | 0–1 | normalized rain |
| `training_easing_rain` | 0.18 | 0–1 | normalized rain |
| `training_ease_at_seconds` | 170 | 0–3600 | race seconds |
| `training_dry_at_seconds` | 280 | 0–7200 | race seconds |
| `training_minimum_race_seconds` | 120 | 1–3600 | seconds |
| `training_light_rain` | 0.2 | 0–1 | normalized rain |
| `training_heavy_rain` | 0.8 | 0–1 | normalized rain |
| `training_light_from` | 0.25 | 0–1 | estimated race fraction |
| `training_heavy_from` | 0.32 | 0–1 | estimated race fraction |
| `training_heavy_to` | 0.61 | 0–1 | estimated race fraction |
| `training_light_to` | 0.7 | 0–1 | estimated race fraction |

## `surface`

| Field | Default | Range | Unit |
|---|---:|---:|---|
| `initial_dust` | 0.11 | 0–1 | normalized deposit |
| `edge_dust_per_lane` | 0.014 | 0–0.3 | deposit / lateral strip |
| `initial_marbles` | 0.012 | 0–1 | normalized deposit |
| `initial_wet_threshold` | 0.1 | 0–1 | normalized water |
| `initial_wet_c` | 20 | 0–80 | degrees C |
| `initial_dry_c` | 29 | 0–80 | degrees C |
| `rubber_grip_gain` | 0.17 | 0–1 | grip / rubber |
| `wet_rubber_threshold` | 0.2 | 0–1 | normalized water |
| `wet_rubber_grip_loss` | 0.1 | 0–1 | grip / wet rubber |
| `dust_grip_loss` | 0.13 | 0–1 | grip / dust |
| `marbles_grip_loss` | 0.17 | 0–1 | grip / marbles |
| `debris_grip_loss` | 0.14 | 0–1 | grip / debris |
| `oil_grip_loss` | 0.43 | 0–1 | grip / oil |
| `base_grip` | 0.96 | 0.1–1.5 | normalized grip |
| `water_grip_loss` | 0.3 | 0–1 | grip / water |
| `water_squared_grip_loss` | 0.13 | 0–1 | grip / water squared |
| `minimum_grip` | 0.3 | 0.05–1 | normalized grip |
| `maximum_grip` | 1.14 | 0.1–1.5 | normalized grip |
| `lateral_exchange_rate` | 0.02 | 0–0.2 | 1 / second |
| `camber_flow_gain` | 0.2 | 0–1 | normalized flow |
| `water_flow_gain` | 0.08 | 0–1 | normalized flow |
| `local_rain_base` | 0.85 | 0–2 | rain multiplier |
| `local_rain_amplitude` | 0.3 | 0–2 | rain multiplier |
| `rain_station_phase` | 0.077 | 0–6.3 | radians / station |
| `rain_time_phase` | 0.002 | 0–0.1 | radians / second |
| `minimum_local_rain` | 0.5 | 0–2 | rain multiplier |
| `maximum_local_rain` | 1.2 | 0–2 | rain multiplier |
| `minimum_drainage` | 0.15 | 0.01–2 | drainage multiplier |
| `camber_drainage_gain` | 2 | 0–10 | drainage / camber |
| `evaporation_base` | 0.00046 | 0–0.01 | water / second |
| `evaporation_reference_c` | 15 | 0–80 | degrees C |
| `evaporation_heat_gain` | 1.8e-05 | 0–0.001 | water / degree C / second |
| `rain_collection_rate` | 0.008 | 0–0.1 | water / rain / second |
| `drainage_rate` | 0.0015 | 0–0.1 | water / second |
| `drainage_base` | 0.22 | 0–2 | water multiplier |
| `rain_wet_threshold` | 0.1 | 0–2 | local rain |
| `wet_evaporation_multiplier` | 0.18 | 0–1 | multiplier |
| `rubber_rain_wash` | 0.00155 | 0–0.1 | 1 / second |
| `rubber_water_wash` | 5e-05 | 0–0.1 | 1 / second |
| `dust_rain_wash` | 0.00027 | 0–0.1 | deposit / second |
| `marbles_rain_wash` | 0.00015 | 0–0.1 | deposit / second |
| `oil_rain_wash` | 0.00014 | 0–0.1 | deposit / second |
| `oil_decay` | 0.00015 | 0–0.1 | deposit / second |
| `debris_decay` | 0.00022 | 0–0.1 | deposit / second |
| `wet_target_c` | 19 | 0–80 | degrees C |
| `dry_target_c` | 32 | 0–80 | degrees C |
| `temperature_response_per_second` | 0.006 | 0–1 | 1 / second |
| `contact_width_lanes` | 0.65 | 0.1–2 | lateral strips |
| `minimum_contact_weight` | 0.004 | 0–0.5 | contact weight |
| `rubber_deposit` | 0.009 | 0–0.1 | deposit / normalized contact distance |
| `wet_tyre_displacement` | 0.021 | 0–0.2 | water / normalized contact distance |
| `dry_tyre_displacement` | 0.013 | 0–0.2 | water / normalized contact distance |
| `dust_sweep` | 0.021 | 0–0.2 | deposit / normalized contact distance |
| `marbles_sweep` | 0.005 | 0–0.2 | deposit / normalized contact distance |
| `maximum_temperature_c` | 80 | 1–100 | degrees C |
| `contact_heating_c` | 0.022 | 0–1 | degrees C / contact distance |
| `braking_heating_c` | 0.06 | 0–2 | degrees C / braking / contact distance |
| `marbles_deposit` | 0.004 | 0–0.2 | deposit / normalized contact distance |
| `push_marbles_multiplier` | 1.4 | 1–5 | multiplier |
| `debris_spread_multiplier` | 0.35 | 0–1 | adjacent-station multiplier |
| `incident_oil_deposit` | 0.42 | 0–1 | normalized oil |

## `weather_forecast`

| Field | Default | Range | Unit |
|---|---:|---:|---|
| `history_window_seconds` | 60 | 2–600 | seconds |
| `minimum_trend_seconds` | 15 | 1–300 | seconds |
| `maximum_water_slope` | 0.006 | 1e-05–0.1 | water / second |
| `horizon_laps` | 3 | 0.1–10 | reference laps |
| `minimum_horizon_seconds` | 60 | 1–600 | seconds |
| `maximum_horizon_seconds` | 240 | 2–1200 | seconds |
| `trend_projection_factor` | 0.65 | 0–2 | multiplier |
| `maximum_case_spread` | 0.5 | 0.01–1 | normalized water |
| `base_case_spread` | 0.12 | 0–1 | normalized water |
| `case_spread_per_second` | 0.0012 | 0–0.02 | water / second |
| `missing_trend_spread` | 0.08 | 0–1 | normalized water |
| `trend_threshold` | 0.0003 | 0–0.1 | water / second |
| `rain_observed_threshold` | 0.08 | 0.001–0.5 | normalized rain |
| `cloud_trend_threshold` | 0.001 | 1e-05–0.1 | cloud / second |
| `cloud_arrival_threshold` | 0.3 | 0–1 | normalized cloud |
| `cloud_arrival_reference` | 0.6 | 0–1 | normalized cloud |
| `arrival_estimate_floor_seconds` | 20 | 1–120 | seconds |
| `arrival_low_floor_seconds` | 15 | 0–120 | seconds |
| `arrival_low_multiplier` | 0.5 | 0.01–1 | multiplier |
| `arrival_high_cap_seconds` | 480 | 120–3600 | seconds |
| `arrival_high_floor_seconds` | 60 | 1–600 | seconds |
| `arrival_high_multiplier` | 2 | 1–5 | multiplier |
| `arrival_high_buffer_seconds` | 30 | 0–300 | seconds |
| `dry_water_limit` | 0.08 | 0–1 | normalized water |
| `damp_water_limit` | 0.24 | 0–1 | normalized water |
| `wet_water_limit` | 0.68 | 0–1 | normalized water |
| `slick_warning_water` | 0.3 | 0–1 | peak water |
| `wet_tyre_warning_water` | 0.15 | 0–1 | mean water |
| `arrival_warning_water` | 0.24 | 0–1 | mean water |
| `delegate_tyre_floor` | 18 | 0–100 | percent tread |
| `delegate_damage_ceiling` | 24 | 0–1000 | damage units |
| `delegate_dry_water` | 0.1 | 0–1 | mean water |
| `review_interval_seconds` | 15 | 1–120 | seconds |
| `minimum_robust_gain_seconds` | 2 | 0–60 | seconds |
| `minimum_nominal_gain_seconds` | 4 | 0–60 | seconds |
| `nominal_pit_gain_ratio` | 0.25 | 0–2 | pit loss multiplier |
| `maximum_downside_pit_ratio` | 0.5 | 0–2 | pit loss multiplier |
| `traffic_cost_seconds` | 0.8 | 0–10 | seconds / traffic car |
| `sector_contrast_factor` | 0.5 | 0–1 | multiplier |
| `comparison_uncertainty_seconds` | 3 | 0–60 | seconds |
| `critical_life_percent` | 10 | 0–100 | percent tread |
| `moderate_life_percent` | 25 | 0–100 | percent tread |

## Consumers and guards

`weather`: initial surface and weather, seeded transition model, explicit scripted training schedule, observation cadence, and checkpoint limits. Target base plus span must fit [0, 1]; transition duration cannot exceed the engine-owned 600-second bound; scripted windows must be ordered.

`surface`: initial deposits and temperatures, grip, rainfall/runoff/evaporation, washing, traffic deposits, and incident contamination. Charts and grip overlays use the same parameters. Pairwise exchange is still conservative. Temperatures must stay inside the supported 0–100 °C surface representation; configured evaporation reference cannot exceed a configured initial/equilibrium temperature.

`weather_forecast`: only measured rain/cloud/surface history enters forecasting. Configuration controls history/horizon, stress-case spread, warning thresholds, comparison uncertainty and the delegated crossover policy. It never supplies hidden future weather, private rival plans or live RNG. The comparison still uses a fixed, bounded three-case/24-lap algorithm.

Presentation-only language such as dry/damp/wet is derived through the forecast query. Changing these cutoffs does not itself change physical grip; the `surface` and tyre definitions govern that.

## Author an environment variant

Clone `core.race_tuning.default` into an external pack, retaining the complete groups:

```sh
python3 scripts/content.py clone core.race_tuning.default --as local.club.race_tuning.rain --pack ./my-pack --godot /path/to/godot
python3 scripts/content.py validate ./my-pack --godot /path/to/godot
```

Set `race_tuning_id` in an external weekend to the new ID and choose `seeded`
or `scripted_training` through its supported `weather_mode`. For example,
`weather.target_base_seconds = 300`, `weather.target_jitter_seconds = 0`,
and `weather.observation_interval_seconds = 2` create a longer changing-weather
interval with more frequent *observations*, without exposing its future target.
The chosen `scenario` still determines the supported dry/wet/changeable family.
Do not confuse the number of observed samples with better prediction certainty.

`content_environment_tests` exercises loading, interdependent bounds, previous-v1
record identity, default equivalence, surface conservation, query agreement,
public-information isolation and continued save/replay after deleting a pack.
The native export verifier also runs a seeded wet practice with a 300-second
transition; both Linux binaries must resume that state after all source files
are removed. This is automated contract evidence, not weather calibration.

## Recorded loading and stepping comparison

On the available AMD EPYC 9V74 host (five logical processors exposed), Godot
4.7.2 Linux/headless ran the same 12-car race-state fixture for 100 warm-up and
1,000 measured fixed steps, three repetitions with rotated case order. The
baseline is tree `02ad1c07b1fe6e2595b446f850ef8ddb4b3baba3`; the candidate adds
this environment extraction. These are local measurements, not a performance
budget, a statistically isolated overhead estimate, or a rendering/FPS claim.

| Case | Baseline median ms | Environment median ms |
|---|---:|---:|
| Immutable legacy defaults | 3,271.128 | 3,359.610 |
| Authored core tuning | 3,165.124 | 3,431.152 |
| Authored tuning with 500 unused vehicle definitions installed | 3,356.772 | 3,337.924 |

Core loading measured 24.440/27.528 ms and expanded-catalog preparation measured
53.041/48.181 ms (baseline/candidate), outside the timed fixed-step loop. All six
case outcomes, including RNG, had the same hash after excluding only the frozen
tuning metadata. The differing deltas and small sample do not establish a
speedup or prove zero overhead. The registered `content_performance_tests`
retains raw timings and verifies outcome equality without an arbitrary timing
pass threshold. Larger catalog construction is not work repeated by each car.
