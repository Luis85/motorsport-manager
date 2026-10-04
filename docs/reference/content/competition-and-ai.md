# Competition and AI reference

The optional `race_tuning.competition` section configures existing behavior.
Omission in an older saved definition resolves only to the immutable `LegacyCompetition` values.
New core and example content author this section explicitly.

## Rival profiles

Add an entry to `profiles` with a unique ID, label, summary and six bounded weights in
`pit_cost`, `offset`, `traffic`, `extend`, `cover`, `uncertainty` order. Profiles are assigned
to non-player teams in first-entry order, cycling through the authored array. Up to 16
profiles are supported. `legacy` is reserved. No source or UI enum needs changing.
Names and summaries are public; exact car resources, proposed stops and decision scores remain private.
Changing profile order affects only new sessions. Saves freeze the complete table.

Shortlist regret is at most four seconds and preference magnitude at most four; profiles cannot
authorize invalid stops, read hidden future weather or grant grip/resources. These remain engine contracts.

The `local.club.weekend.strategy_sprint` example enables the custom profile. The
original `local.club.weekend.sprint` retains its explicit classic-policy setting.
Both use the same underlying content and model.

## policy

| Field | Default | Bounds | Meaning |
|---|---:|---|---|
| `conserve_tread` | 30.0 | 0–100 | tread percent: Classic engineer begins conserving below this value. |
| `fuel_reserve_factor` | 1.03 | 0.5–2 | multiplier: Classic engineer fuel target relative to remaining laps. |
| `stop_remaining_laps` | 0.8 | 0–10 | laps: Minimum remaining distance for a discretionary stop. |
| `stop_start_laps` | 0.25 | 0–10 | laps: Minimum completed distance for a classic discretionary stop. |
| `stop_tread` | 25.0 | 0–100 | tread percent: Classic routine tyre-stop threshold. |
| `repair_damage` | 24.0 | 0–1000 | damage units: Delegated recovery threshold. |
| `pace_temperature_c` | 120.0 | 0–200 | Celsius: Delegated pace protection threshold. |
| `attack_tread` | 35.0 | 0–100 | tread percent: Minimum usable life for delegated assertive mode. |
| `attack_damage` | 12.0 | 0–1000 | damage units: Maximum damage for delegated assertive mode. |
| `review_seconds` | 12.0 | 0.05–120 | seconds: Interval between discretionary strategy reviews. |
| `review_stagger_seconds` | 1.0 | 0–10 | seconds: Per-driver modulo-three review staggering. |
| `healthy_tread` | 80.0 | 0–100 | tread percent: Classic strategy can skip a discretionary review above this value. |
| `urgent_tread` | 18.0 | 0–100 | tread percent: Urgent resource recovery threshold. |
| `minimum_gain_seconds` | 3.0 | 0–30 | seconds: Minimum estimated gain for an ordinary delegated stop. |
| `pit_loss_gain_factor` | 0.12 | 0–1 | multiplier: Required gain relative to estimated pit loss. |
| `traffic_queue_seconds` | 1.0 | 0–30 | seconds: Queue at which an approved avoid-traffic branch may wait. |

## rivals

| Field | Default | Bounds | Meaning |
|---|---:|---|---|
| `nearby_gap_seconds` | 2.5 | 0.01–10 | seconds: Observed gap qualifying as nearby race-position traffic. |
| `traffic_seconds_per_car` | 0.8 | 0–10 | seconds/car: Coarse cost of predicted rejoin traffic. |
| `observation_age_seconds` | 40.0 | 0.05–120 | seconds: Maximum age of a public stop used in a response. |
| `behind_gap_seconds` | 4.0 | 0–20 | seconds: How far behind an observed stop the classic response considers. |
| `cover_gap_seconds` | 8.0 | 0–30 | seconds: Maximum estimated ahead gap considered for covering. |
| `offset_laps` | 2.0 | 0–10 | laps: Hypothetical early-stop tyre advantage horizon. |
| `cover_scale_seconds` | 2.0 | 0.01–30 | seconds: Cover utility normalization; not a probability. |
| `cover_margin_seconds` | 0.3 | 0–10 | seconds: Classic response minimum cover margin. |
| `cover_minimum_gain` | -1.0 | -30–30 | seconds: Lowest ordinary-stop gain accepted for a classic cover. |
| `extend_remaining_laps` | 3.0 | 1–20 | laps: Required remaining distance for discretionary extension. |
| `extend_tread` | 35.0 | 0–100 | tread percent: Required life for discretionary extension. |
| `extend_traffic_seconds` | 1.5 | 0–30 | seconds: Classic extension traffic-cost threshold. |
| `extend_fresh_gain_seconds` | 1.5 | 0–30 | seconds/lap: Classic extension threshold for fresh-tyre advantage. |
| `shortlist_seconds` | 4.0 | 0–4 | seconds: Maximum regret allowed in the near-best shortlist; hard diagnostic ceiling remains four. |
| `position_scale` | 3.0 | 0.01–24 | places: Position-loss utility normalization. |
| `offset_scale_seconds` | 2.0 | 0.01–30 | seconds/lap: Fresh-tyre utility normalization. |
| `uncertainty_weight` | 2.0 | 0–4 | multiplier: Moderate-risk preference penalty. |
| `extend_credit_seconds` | 1.5 | 0–4 | seconds: Maximum extension preference credit for avoiding traffic. |
| `extend_traffic_factor` | 0.25 | 0–2 | multiplier: Extension credit relative to traffic cost. |
| `threat_position_factor` | 0.25 | 0–2 | multiplier: Track-position preference when a car is close behind. |
| `duel_queue_seconds` | 1.0 | 0–30 | seconds: Maximum predicted queue before tactical cover is declined. |
| `duel_cover_score` | 2.0 | -4–8 | score units: Highest shortlisted cover score acceptable to the tactical policy. |

## battle

| Field | Default | Bounds | Meaning |
|---|---:|---|---|
| `resolved_cooldown_seconds` | 2.0 | 0.05–60 | seconds: Cooldown after a completed pass. |
| `recovery_cooldown_seconds` | 3.0 | 0.05–60 | seconds: Cooldown after an aborted contest. |
| `acquire_distance_m` | 120.0 | 10–500 | metres: Maximum absolute distance to acquire a battle target. |
| `release_distance_m` | 180.0 | 10–1000 | metres: Maximum distance before a battle target is released. |
| `prepare_distance_m` | 75.0 | 5–500 | metres: Start preparing once the target closes to this gap. |
| `minimum_road_width_m` | 7.5 | 7.5–30 | metres: Required road width, never less than the corridor safety floor. |
| `maximum_curvature_per_m` | 0.035 | 0.001–0.05 | inverse metres: Maximum curvature supporting an attempt. |
| `minimum_grip` | 0.45 | 0.3–1.1 | multiplier: Minimum modeled local grip for a passing attempt. |
| `patient_preparation_seconds` | 1.5 | 0.05–30 | seconds: Preparation delay under patient racecraft. |
| `balanced_preparation_seconds` | 0.8 | 0.05–30 | seconds: Preparation delay under balanced racecraft. |
| `assertive_preparation_seconds` | 0.4 | 0.05–30 | seconds: Preparation delay under assertive racecraft. |
| `probe_seconds` | 0.25 | 0.05–10 | seconds: Minimum probe duration before committing. |
| `overlap_timeout_seconds` | 15.0 | 0.05–60 | seconds: Abandon an attempt that fails to make timely overlap. |

| `patient_speed_advantage_mps` | 2.0 | 0–10 | metres/second: Required closing speed in patient mode. |
| `balanced_speed_advantage_mps` | 0.4 | 0–10 | metres/second: Required closing speed in balanced mode. |
| `assertive_speed_advantage_mps` | 0.1 | 0–10 | metres/second: Required closing speed in assertive mode. |
| `patient_maximum_water` | 0.5 | 0–1 | fraction: Patient drivers decline a discretionary pass above this local water level. |

The persistent battle controller and base corridor proposal consume the same
authored closing-speed thresholds; collision clearances remain fixed safety rules.

## movement

| Field | Default | Bounds | Meaning |
|---|---:|---|---|
| `wet_skill_reference` | 85.0 | 0–100 | skill points: Reference wet-driving rating. |
| `wet_skill_factor` | 0.004 | 0–0.009 | multiplier/skill point: Wet-skill handling contribution. |
| `straight_curvature_per_m` | 0.005 | 0.0001–0.02 | inverse metres: Threshold for applying setup straight-line effects. |
| `damaged_tyre_speed_mps` | 27.0 | 1–60 | metres/second: Target speed cap on an unusable fitted set. |
| `run_transit_factor` | 0.76 | 0.1–1 | multiplier: Speed envelope on non-flying session laps. |
| `run_transit_speed_mps` | 48.0 | 5–100 | metres/second: Non-flying lap target speed cap. |
| `formation_speed_factor` | 0.65 | 0.1–1 | multiplier: Formation speed envelope. |
| `formation_speed_mps` | 30.0 | 5–60 | metres/second: Formation target speed cap. |
| `formation_release_seconds` | 0.22 | 0–2 | seconds/grid place: Formation release spacing. |
| `start_reaction_seconds` | 0.15 | 0–2 | seconds: Base standing-start response delay. |
| `start_skill_seconds` | 0.008 | 0–0.1 | seconds/skill deficit: Standing-start response increment. |
| `yield_speed_mps` | 43.0 | 5–80 | metres/second: Courtesy speed cap after lateral clearance. |
| `wake_distance_m` | 75.0 | 10–200 | metres: Following range used by the existing slipstream/dirty-air model. |
| `slipstream_curvature_per_m` | 0.004 | 0.0001–0.02 | inverse metres: Straight-line threshold for the slipstream effect. |
| `slipstream_factor` | 1.022 | 1–1.1 | multiplier: Speed-envelope slipstream factor. |
| `dirty_air_factor` | 0.991 | 0.8–1 | multiplier: Speed-envelope dirty-air factor. |
| `following_headway_seconds` | 0.8 | 0.1–3 | seconds: Desired following headway before longitudinal constraints. |
| `following_response_per_second` | 0.7 | 0.1–3 | per second: Response to distance from the safe following reference. |
| `lateral_speed_mps` | 1.8 | 0.1–4 | metres/second: Maximum requested lane-change rate; occupied-lane checks remain authoritative. |

## team

| Field | Default | Bounds | Meaning |
|---|---:|---|---|
| `yield_maximum_gap_m` | 120.0 | 10–500 | metres: Maximum gap at which a team yield may be requested. |
| `yield_execution_gap_m` | 65.0 | 5–500 | metres: Maximum gap for executing a safe team yield. |
| `yield_width_m` | 8.0 | 8–30 | metres: Required width for yielding; no lower than the safety floor. |
| `yield_curvature_per_m` | 0.015 | 0.001–0.03 | inverse metres: Maximum curvature for executing a team yield. |
| `yield_grip` | 0.6 | 0.45–1.1 | multiplier: Minimum grip for team cooperation. |
| `yield_speed_factor` | 0.88 | 0.5–1 | multiplier: Bounded team-yield speed reduction after physical clearance. |
| `yield_speed_delta_mps` | 2.0 | 0–10 | metres/second: Requested speed difference to the passing teammate. |
| `priority_wear_factor` | 1.5 | 1–5 | multiplier: One-entry tyre-wear reserve for deferring the second car. |
| `priority_tread` | 18.0 | 0–100 | tread percent: Minimum projected remaining life when deferring a priority stop. |
| `priority_queue_margin_seconds` | 2.0 | 0–30 | seconds: Additional shared-service overlap margin. |

## Engine-owned boundaries

Collision clearances, overlap measurements, topology, fixed-step/RNG logic, physics constants,
numerical tolerances, collection limits, command permissions, supported modes and phases remain code.
A profile configures a supported strategy; it does not implement a new strategy algorithm.
The shared-box forecast now uses the same service calibration as physical pit operations.
