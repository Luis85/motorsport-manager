# Weather and surface authoring

This extends the native race-tuning contract with an optional, versioned
`environment` object (`model: weather-surface-v1`). The shipped core and club
packs contain the complete object. Edit the chosen `race_tuning/*.json` outside
the executable, then validate and launch a new weekend. All values are fictional
normalized game-model coefficients, not meteorological or fluid-dynamics data.

## Ownership and compatibility

The selected `RaceTuningDefinition` freezes environment values at construction.
Seeded weather, scripted training schedules, initial track conditions, water and
contamination evolution, contact deposits, runtime grip, public forecasts,
weather delegation and grip overlays consume those same inputs. Running sessions
never reread a pack. Exported checkpoints/replays include the environment in their
existing frozen tuning record. Removing a source pack does not change a saved
session. Replacing definitions within a replay is rejected even when its outer
digest is recomputed.

A pre-extension v1 tuning record with no `environment` keeps its original record
and fingerprint. Its runtime resolves `LegacyEnvironment` (the pre-extraction
constants), not an installed core pack. An explicitly supplied environment must
be complete: missing children, unknown fields, wrong types, unsupported model IDs,
and invalid parameter combinations fail before catalog activation. Old binaries
will reject the new optional field rather than ignore it; forward loading is not
promised. Any future change of meaning requires another explicit model contract.

The engine still owns the 0.05-second simulation step, separate weather LCG,
96-by-7 surface grid, 0.25-second surface cadence, observation/history bounds,
three forecast stress cases, bounded 24-lap forecast work and conservative runoff
exchange cap. These are algorithms, resolution or safety constraints, not pack
privileges. Weather coefficients preserve arithmetic and random-draw order;
setting jitter to zero still consumes the corresponding draw.

## Information and authoring rules

Only public observation history and `environment.outlook` reach `WeatherOutlook`.
It cannot inspect the private target, remaining transition time, weather RNG or
future training schedule. Its cases remain uncalibrated stress cases, not
probabilities. Labels in the weather panel use the same public thresholds as the
outlook, not an independently hardcoded classification. A calibration change
invalidates the public outlook key; all authored tuning also participates in the
material strategy key.

Weather policy settings affect every delegated team equally and cannot bypass
manual ownership, binding plans, finite stock, physical gates or recovery. They
do not command a stop merely because an alert appears. The director's optional
check-in bands remain a separate presentation contract.

Semantic validation checks cloud base-plus-span bounds, maximum saved transition
time, ordered training windows, initial dust bounds, grip/rain clamps,
nonnegative evaporation, valid temperature ceilings, forecast windows and tread
risk ordering. A failed reload preserves the last valid catalog and includes the
file, definition and conflicting field in its diagnostic.

Example: increase `environment.surface.evolution.water_drainage` to make the
same circuit drain more quickly. Change the corresponding weekend's
`weather_mode` only when deliberately choosing seeded versus scripted training.
New sessions use the edit; existing sessions retain the former drainage model.
Do not edit the compatibility constants to rebalance ordinary gameplay.

## Field reference

Ranges below are individual schema bounds; combinations are checked as described
above. `fraction` is a normalized 0–1 quantity. A normalized contact distance is
travel divided by the length of one surface station. Units and meanings are also
embedded in the generated JSON Schema for editor assistance.

| Path below `environment` | Default | Range | Unit / meaning |
|---|---:|---|---|
| `weather/initial_cloud_dry` | 0.18 | 0–1 | fraction — Initial observed cloud in a dry session. |
| `weather/initial_cloud_wet` | 0.94 | 0–1 | fraction — Initial observed cloud in a wet session. |
| `weather/initial_cloud_changeable_base` | 0.32 | 0–1 | fraction — Base initial cloud in changeable sessions. |
| `weather/initial_cloud_changeable_span` | 0.3 | 0–1 | fraction — Uniform initial-cloud jitter; a draw is retained when zero. |
| `weather/initial_rain_wet` | 0.65 | 0–1 | fraction — Initial rainfall in a wet seeded session; dry/changeable start at zero. |
| `weather/target_dry_base` | 0.12 | 0–1 | fraction — Base cloud target for dry sessions; dry rainfall stays zero. |
| `weather/target_dry_span` | 0.28 | 0–1 | fraction — Uniform dry target jitter. |
| `weather/target_wet_base` | 0.28 | 0–1 | fraction — Base wet cloud target. |
| `weather/target_wet_span` | 0.72 | 0–1 | fraction — Uniform wet target jitter. |
| `weather/target_changeable_base` | 0.05 | 0–1 | fraction — Base changeable cloud target. |
| `weather/target_changeable_span` | 0.95 | 0–1 | fraction — Uniform changeable target jitter. |
| `weather/transition_base_seconds` | 45.0 | 1–145 | seconds — Minimum time between cloud-target choices. |
| `weather/transition_span_seconds` | 100.0 | 0–144 | seconds — Uniform transition-duration jitter; base plus span cannot exceed 145. |
| `weather/cloud_response_per_second` | 0.005 | 1e-05–0.2 | fraction/second — Maximum cloud movement toward the hidden target. |
| `weather/rain_cloud_threshold` | 0.52 | 0–0.99 | fraction — Cloud level above which rain is generated. |
| `weather/rain_cloud_gain` | 2.5 | 0.01–20 | multiplier — Gain applied above the cloud threshold, before clamping rainfall to [0,1]. |
| `weather/rain_response_per_second` | 0.008 | 1e-05–0.2 | fraction/second — Maximum rainfall movement per simulated second. |
| `training/wet_heavy_rain` | 0.65 | 0–1 | fraction — Rainfall before the wet-training easing boundary. |
| `training/wet_eased_rain` | 0.18 | 0–1 | fraction — Rainfall between wet-training easing and dry boundaries. |
| `training/wet_ease_seconds` | 170.0 | 0–3600 | race seconds — Wet-training easing boundary; non-race phases retain heavy rain. |
| `training/wet_dry_seconds` | 280.0 | 0–7200 | race seconds — Wet-training dry boundary, not earlier than easing. |
| `training/changeable_light_rain` | 0.2 | 0–1 | fraction — Light rainfall inside the outer changeable-training window. |
| `training/changeable_heavy_rain` | 0.8 | 0–1 | fraction — Heavy rainfall inside the inner changeable-training window. |
| `training/changeable_light_start` | 0.25 | 0–1 | race-duration fraction — Exclusive outer-window start. |
| `training/changeable_heavy_start` | 0.32 | 0–1 | race-duration fraction — Exclusive inner-window start. |
| `training/changeable_heavy_end` | 0.61 | 0–1 | race-duration fraction — Exclusive inner-window end. |
| `training/changeable_light_end` | 0.7 | 0–1 | race-duration fraction — Exclusive outer-window end. |
| `training/minimum_race_seconds` | 120.0 | 1–1200 | seconds — Lower bound on the reference duration used to scale training windows. |
| `surface/initial/dry_water` | 0.0 | 0–1 | fraction — Initial line water for dry and changeable sessions. |
| `surface/initial/wet_water` | 0.6 | 0–1 | fraction — Initial line water for wet sessions. |
| `surface/initial/rubber` | 0.12 | 0–1 | fraction — Initial rubber on each strip. |
| `surface/initial/dust_base` | 0.11 | 0–1 | fraction — Initial centre-strip dust. |
| `surface/initial/dust_per_strip` | 0.014 | 0–0.33 | fraction/strip — Dust added for each strip away from the centre; total must fit [0,1]. |
| `surface/initial/marbles` | 0.012 | 0–1 | fraction — Initial rubber debris on every strip. |
| `surface/initial/wet_threshold` | 0.1 | 0–1 | fraction — Initial water threshold for choosing wet temperature. |
| `surface/initial/wet_temperature_c` | 20.0 | 0–80 | Celsius — Initial wet surface temperature. |
| `surface/initial/dry_temperature_c` | 29.0 | 0–80 | Celsius — Initial dry surface temperature. |
| `surface/grip/base` | 0.96 | 0.3–1.3 | multiplier — Clean-surface grip before rubber, water and contamination. |
| `surface/grip/rubber_gain` | 0.17 | 0–0.5 | multiplier — Dry rubber gain; reduced quadratically by water. |
| `surface/grip/wet_rubber_threshold` | 0.2 | 0–1 | fraction — Water threshold for rubber becoming a grip penalty. |
| `surface/grip/wet_rubber_loss` | 0.1 | 0–0.5 | multiplier — Wet-rubber grip penalty. |
| `surface/grip/dust_loss` | 0.13 | 0–1 | multiplier — Dust grip penalty. |
| `surface/grip/marbles_loss` | 0.17 | 0–1 | multiplier — Rubber-debris grip penalty. |
| `surface/grip/debris_loss` | 0.14 | 0–1 | multiplier — Incident-debris grip penalty. |
| `surface/grip/oil_loss` | 0.43 | 0–1 | multiplier — Oil grip penalty. |
| `surface/grip/water_linear_loss` | 0.3 | 0–1 | multiplier — Linear standing-water grip penalty. |
| `surface/grip/water_squared_loss` | 0.13 | 0–1 | multiplier — Quadratic standing-water grip penalty. |
| `surface/grip/minimum` | 0.3 | 0.05–1 | multiplier — Minimum effective surface grip. |
| `surface/grip/maximum` | 1.14 | 0.5–1.5 | multiplier — Maximum grip and normalization of the grip overlay. |
| `surface/runoff/diffusion_per_second` | 0.02 | 0–1 | per second — Pairwise water diffusion rate. |
| `surface/runoff/camber_factor` | 0.2 | 0–2 | multiplier — Camber contribution to lateral runoff. |
| `surface/runoff/advection_per_second` | 0.08 | 0–1 | per second — Slope-driven lateral water movement; conservative exchange is still bounded by code. |
| `surface/evolution/rain_base` | 0.85 | 0–2 | multiplier — Base local rainfall modulation. |
| `surface/evolution/rain_amplitude` | 0.3 | 0–1 | multiplier — Sinusoidal spatial rainfall amplitude. |
| `surface/evolution/rain_station_radians` | 0.077 | 0–1 | radians/station — Spatial rainfall modulation frequency. |
| `surface/evolution/rain_time_radians` | 0.002 | 0–0.1 | radians/second — Time frequency of rainfall modulation. |
| `surface/evolution/rain_minimum` | 0.5 | 0–2 | multiplier — Lower clamp for local rainfall modulation. |
| `surface/evolution/rain_maximum` | 1.2 | 0–2 | multiplier — Upper clamp for local rainfall modulation. |
| `surface/evolution/drainage_minimum` | 0.15 | 0.01–1 | multiplier — Minimum local drainage capability. |
| `surface/evolution/drainage_camber` | 2.0 | 0–5 | multiplier — Signed camber contribution to longitudinal drainage. |
| `surface/evolution/evaporation_base` | 0.00046 | 0–0.02 | fraction/second — Evaporation at the reference temperature. |
| `surface/evolution/evaporation_reference_c` | 15.0 | 0–60 | Celsius — Reference temperature for evaporation. |
| `surface/evolution/evaporation_temperature` | 1.8e-05 | 0–0.0002 | fraction/second/Celsius — Temperature-dependent evaporation; total cannot become negative at 0 C. |
| `surface/evolution/water_arrival` | 0.008 | 0–0.1 | fraction/second — Rain-driven water accumulation coefficient. |
| `surface/evolution/water_drainage` | 0.0015 | 0–0.1 | fraction/second — Local drainage coefficient. |
| `surface/evolution/water_drainage_base` | 0.22 | 0–1 | multiplier — Base drainage in addition to square-root water depth. |
| `surface/evolution/rain_threshold` | 0.1 | 0–1 | fraction — Local rain threshold for reduced evaporation and wet temperature target. |
| `surface/evolution/wet_evaporation` | 0.18 | 0–1 | multiplier — Evaporation multiplier above the rain threshold. |
| `surface/evolution/rain_rubber_wash` | 0.00155 | 0–0.1 | per second — Rain-driven rubber wash. |
| `surface/evolution/water_rubber_wash` | 5e-05 | 0–0.1 | per second — Standing-water rubber wash. |
| `surface/evolution/dust_wash` | 0.00027 | 0–0.1 | fraction/second — Rain-driven dust removal. |
| `surface/evolution/marbles_wash` | 0.00015 | 0–0.1 | fraction/second — Rain-driven rubber-debris removal. |
| `surface/evolution/oil_wash` | 0.00014 | 0–0.1 | fraction/second — Rain-driven oil removal. |
| `surface/evolution/oil_decay` | 0.00015 | 0–0.1 | fraction/second — Oil decay without rain. |
| `surface/evolution/debris_decay` | 0.00022 | 0–0.1 | fraction/second — Incident-debris removal. |
| `surface/evolution/wet_temperature_c` | 19.0 | 0–80 | Celsius — Wet surface temperature target. |
| `surface/evolution/dry_temperature_c` | 32.0 | 0–80 | Celsius — Dry surface temperature target. |
| `surface/evolution/temperature_response` | 0.006 | 1e-05–1 | per second — Surface temperature interpolation response. |
| `surface/contact/width_strips` | 0.65 | 0.1–3 | strips — Gaussian contact footprint width; grid resolution remains code-owned. |
| `surface/contact/rubber_deposit` | 0.009 | 0–0.1 | fraction/normalized distance — Rubber deposited by passage, reduced quadratically by water. |
| `surface/contact/wet_water_clearance` | 0.021 | 0–0.2 | fraction/normalized distance — Water displaced by a wet-family tyre. |
| `surface/contact/dry_water_clearance` | 0.013 | 0–0.2 | fraction/normalized distance — Water displaced by a dry-family tyre. |
| `surface/contact/dust_clearance` | 0.021 | 0–0.2 | fraction/normalized distance — Dust displaced by contact. |
| `surface/contact/marbles_clearance` | 0.005 | 0–0.2 | fraction/normalized distance — Rubber debris cleared by contact. |
| `surface/contact/temperature_limit_c` | 80.0 | 0–100 | Celsius — Contact-heating ceiling; must cover initial and environment target temperatures. |
| `surface/contact/temperature_gain_c` | 0.022 | 0–2 | Celsius/normalized distance — Contact heating without braking. |
| `surface/contact/braking_temperature_c` | 0.06 | 0–2 | Celsius/normalized distance — Extra contact heating at full braking. |
| `surface/contact/outside_marbles` | 0.004 | 0–0.1 | fraction/normalized distance — Debris deposited on the outside strip. |
| `surface/contact/push_marbles_factor` | 1.4 | 1–3 | multiplier — Outside-debris multiplier at push pace. |
| `surface/incident/debris` | 0.2 | 0–1 | fraction — Debris deposited by the existing incident paths. |
| `surface/incident/adjacent_debris_factor` | 0.35 | 0–1 | multiplier — Debris deposited on adjacent stations. |
| `surface/incident/oil` | 0.42 | 0–1 | fraction — Oil deposited when the incident qualifies. |
| `surface/incident/oil_health_threshold` | 50.0 | 0–100 | health points — Oil qualification threshold for incident contamination. |
| `outlook/condition_dry` | 0.08 | 0–1 | fraction — Dry/damp line-water label boundary. |
| `outlook/condition_damp` | 0.24 | 0–1 | fraction — Damp/wet line-water label boundary. |
| `outlook/condition_wet` | 0.68 | 0–1 | fraction — Wet/very-wet line-water label boundary. |
| `outlook/history_seconds` | 60.0 | 20–600 | seconds — Public observation window for a trend anchor. |
| `outlook/minimum_trend_seconds` | 15.0 | 10–300 | seconds — Minimum age of public trend evidence. |
| `outlook/maximum_water_slope` | 0.006 | 1e-05–0.1 | fraction/second — Clamp for observed water slope. |
| `outlook/horizon_laps` | 3.0 | 0.25–6 | reference laps — Forecast horizon before applying time bounds. |
| `outlook/horizon_minimum_seconds` | 60.0 | 10–240 | seconds — Shortest forecast horizon. |
| `outlook/horizon_maximum_seconds` | 240.0 | 10–480 | seconds — Longest forecast horizon. |
| `outlook/trend_gain` | 0.65 | 0–2 | multiplier — Extrapolation weight for measured water trend. |
| `outlook/spread_maximum` | 0.5 | 0–1 | fraction — Maximum uncalibrated stress-case spread. |
| `outlook/spread_base` | 0.12 | 0–1 | fraction — Base stress-case spread. |
| `outlook/spread_per_second` | 0.0012 | 0–0.01 | fraction/second — Horizon contribution to the spread. |
| `outlook/spread_without_history` | 0.08 | 0–1 | fraction — Extra spread when evidence is insufficient. |
| `outlook/trend_threshold` | 0.0003 | 0–0.1 | fraction/second — Minimum slope magnitude for a wetting/drying label. |
| `outlook/rain_visible` | 0.08 | 0–1 | fraction — Observed-rain threshold shared by public messaging and weather policy. |
| `outlook/rain_heavy` | 0.6 | 0–1 | fraction — Heavy-rain message threshold. |
| `outlook/arrival_cloud_slope` | 0.001 | 0.0001–0.1 | fraction/second — Minimum observed cloud growth for an arrival estimate. |
| `outlook/arrival_cloud_threshold` | 0.3 | 0–1 | fraction — Minimum observed cloud level for an arrival estimate. |
| `outlook/arrival_cloud_reference` | 0.6 | 0–1 | fraction — Public extrapolation reference, not the hidden weather target. |
| `outlook/arrival_estimate_minimum_seconds` | 20.0 | 1–120 | seconds — Minimum nominal arrival estimate. |
| `outlook/arrival_low_minimum_seconds` | 15.0 | 1–120 | seconds — Minimum lower arrival window endpoint. |
| `outlook/arrival_high_minimum_seconds` | 60.0 | 1–480 | seconds — Minimum upper arrival window endpoint. |
| `outlook/arrival_high_maximum_seconds` | 480.0 | 1–600 | seconds — Upper arrival-window cap. |
| `outlook/arrival_low_factor` | 0.5 | 0.1–1 | multiplier — Lower-window factor applied to the estimate. |
| `outlook/arrival_high_factor` | 2.0 | 1–4 | multiplier — Upper-window factor applied to the estimate. |
| `outlook/arrival_high_margin_seconds` | 30.0 | 0–120 | seconds — Extra margin for the upper arrival estimate. |
| `weather_policy/slick_warning_water` | 0.3 | 0–1 | fraction — Warn a slick-tyre runner above this peak line water. |
| `weather_policy/wet_warning_water` | 0.15 | 0–1 | fraction — Warn a wet-tyre runner below this mean line water. |
| `weather_policy/rain_warning_water` | 0.24 | 0–1 | fraction — Rain-arrival notice is relevant below this mean water. |
| `weather_policy/fallback_tread` | 18.0 | 0–100 | tread percent — Below this level the existing resource/recovery policy takes precedence. |
| `weather_policy/fallback_damage` | 24.0 | 0–100 | damage points — Above this level existing damage recovery takes precedence. |
| `weather_policy/dry_fallback_water` | 0.1 | 0–1 | fraction — Dry-weather ordinary strategy threshold. |
| `weather_policy/review_seconds` | 15.0 | 1–15 | seconds — Base delegated-weather review interval; four-way staggering is code-owned. |
| `weather_policy/minimum_case_gain_seconds` | 2.0 | 0–30 | seconds — Robust case gain sufficient to consider a discretionary stop. |
| `weather_policy/nominal_gain_seconds` | 4.0 | 0–60 | seconds — Minimum nominal gain for the less-conservative alternative criterion. |
| `weather_policy/nominal_pit_loss_factor` | 0.25 | 0–2 | multiplier — Nominal gain required relative to modeled pit loss. |
| `weather_policy/maximum_case_loss_factor` | 0.5 | 0–1 | multiplier — Maximum accepted worst-case loss relative to pit loss. |
| `weather_policy/safe_tread` | 10.0 | 0–100 | tread percent — High-risk threshold used for set comparison and crossover evaluation. |
| `weather_policy/moderate_tread` | 25.0 | 0–100 | tread percent — Moderate-risk threshold in crossover evaluation. |
| `weather_policy/traffic_seconds_per_car` | 0.8 | 0–10 | seconds/car — Coarse public-traffic allowance in crossover scoring. |
| `weather_policy/wettest_sector_factor` | 0.5 | 0–1 | multiplier — Observed wettest-sector contrast retained by the coarse model. |
| `weather_policy/model_allowance_seconds` | 3.0 | 0–30 | seconds — Uncalibrated model allowance around case outcomes and gains. |

## Reproducible evidence

`content_environment_tests` checks malformed fields and cross-field values,
known pre-refactor weather trajectories and surface hashes, read-only projections,
conservative runoff, zero-jitter RNG consumption, model inputs, real weekend
launch and frozen save/replay continuation. The characterization fixture records
its original source and engine; never regenerate it merely to accept changed
physics. `weather_tests`, `weather_ui_smoke`, the 24 sporting checkpoints and the
full registry remain regression gates.

`verify_content_export.py` exercises actual Linux debug/release executables from
a non-writable install and a Unicode/space pack path. It edits drainage and initial
water, switches the example to seeded mode, rejects a semantically broken
weather configuration, removes the pack, and restores the saved state. This is
automated native evidence, not human playtesting, Windows execution or scientific
model calibration.
