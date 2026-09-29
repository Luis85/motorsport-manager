# Race tuning field reference

All values configure existing algorithms. No scripts or arbitrary expressions are accepted.
New sessions use JSON. `LegacyRaceTuning` is the frozen compatibility baseline for old saves only.
Mode arrays always contain exactly three values in the existing conserve/balanced/push or save/standard/attack order.
A changed value is not a claim of real-world calibration. Defaults must remain behaviorally equivalent.

## Combined safety limits

The production compiler additionally checks that a 100-lap starting load stays at or below 200 fuel-laps, that even a 1,000-damage repair fits the 200-second service record limit, and that engine thermal targets remain within 0–200 °C over all supported controls. Mode arrays are nondecreasing; attack health wear cannot be less than normal wear. The runtime's independent 200 m/s safety ceiling matches its checkpoint validator and is not editable by packs.

## fuel

| Field | Default | Bounds | Meaning |
|---|---|---|---|
| `race_load_per_lap` | `1.13` | 0.5–1.8 | Lap-equivalent fuel loaded per scheduled race lap. |
| `race_reserve_laps` | `1.5` | 0–10 | Lap-equivalent fuel added to the race load. |
| `qualifying_load_laps` | `4.0` | 1–20 | Lap-equivalent fuel loaded on qualifying release. |
| `practice_load_per_lap` | `1.14` | 0.5–2 | Practice fuel per requested flying lap. |
| `practice_reserve_laps` | `3.0` | 0–10 | Practice fuel allowance for transit and reserve. |
| `reduced_rate` | `0.6` | 0.1–2 | Consumption per lap during formation and non-flying run laps. |
| `engine_rates` | `[0.84, 1.0, 1.14]` | 0.1–3 | Consumption per lap: save, standard, attack. |
| `runtime_mass_factor` | `0.0007` | 0–0.01 | Runtime speed divisor coefficient per remaining fuel-lap. |
| `forecast_mass_factor` | `0.00035` | 0–0.01 | Coarse forecast average fuel-mass coefficient, not an exact physics claim. |

## pace

| Field | Default | Bounds | Meaning |
|---|---|---|---|
| `skill_reference` | `85.0` | 0–100 | Reference driver skill for the existing handling model. |
| `skill_factor` | `0.002` | 0–0.009 | Handling change per skill point relative to the reference. |
| `speed_modes` | `[0.988, 1.0, 1.01]` | 0.5–1.5 | Speed multipliers: conserve, balanced, push. |
| `engine_modes` | `[0.974, 1.0, 1.014]` | 0.5–1.5 | Speed multipliers: save, standard, attack. |
| `wear_modes` | `[0.78, 1.0, 1.25]` | 0.1–3 | Tyre workload multipliers: conserve, balanced, push. |
| `formation_wear` | `0.55` | 0.1–3 | Tyre workload multiplier during formation. |
| `forecast_wear_factor` | `1.05` | 0.5–2 | Coarse reference wear multiplier shared by practice and advice. |

## service

| Field | Default | Bounds | Meaning |
|---|---|---|---|
| `tyre_base_seconds` | `3.0` | 0.1–30 | Base physical tyre-service duration. |
| `tyre_jitter_seconds` | `1.5` | 0–10 | Uniform service variation span; one existing RNG draw is retained. |
| `repair_base_seconds` | `2.0` | 0.1–30 | Base physical repair-only duration. |
| `repair_jitter_seconds` | `1.0` | 0–10 | Repair-only uniform service variation span. |
| `repair_seconds_per_damage` | `0.14` | 0–1 | Additional service seconds per damage point. |
| `arrival_allowance_seconds` | `1.5` | 0–10 | Coarse forecast box-arrival allowance. |
| `transit_allowance_seconds` | `3.0` | 0–20 | Coarse forecast braking/acceleration allowance. |
| `uncertainty_seconds` | `2.25` | 0.1–20 | Base forecast visit uncertainty, before queue uncertainty. |
| `queue_uncertainty_seconds` | `2.0` | 0–20 | Additional forecast uncertainty when the team box is queued. |
| `warmup_seconds` | `1.5` | 0–20 | Coarse tyre warm-up cost; repair-only visits do not pay it. |

## condition

| Field | Default | Bounds | Meaning |
|---|---|---|---|
| `damage_speed_loss` | `0.003` | 0–0.005 | Speed loss per damage point in the existing aggregate model. |
| `health_reference` | `65.0` | 0–100 | Health below which the speed penalty applies. |
| `health_speed_loss` | `0.002` | 0–0.009 | Speed loss per health point below the reference. |
| `heat_reference_c` | `115.0` | 80–160 | Engine temperature above which performance warnings/loss apply. |
| `heat_speed_loss` | `0.003` | 0–0.005 | Speed loss per degree above the thermal reference. |
| `health_wear_normal` | `0.4` | 0–2 | Health wear per lap in save/standard engine modes. |
| `health_wear_attack` | `0.65` | 0–3 | Health wear per lap in attack engine mode. |
| `wear_heat_reference_c` | `112.0` | 80–160 | Temperature above which health wear increases. |
| `wear_heat_factor` | `0.04` | 0–0.2 | Health-wear increase per degree above its thermal reference. |
| `engine_base_c` | `91.0` | 60–120 | Base thermal target for the engine. |
| `engine_mode_c` | `8.0` | 0–15 | Thermal target increment per engine mode. |
| `cooling_reference` | `5.0` | 1–9 | Setup cooling centre used by the existing thermal model. |
| `cooling_c` | `3.0` | 0–5 | Thermal target reduction per cooling point. |
| `throttle_c` | `12.0` | 0–20 | Thermal target increment at full throttle. |
| `water_c` | `8.0` | 0–20 | Thermal target reduction at full surface water. |
| `engine_response_per_second` | `0.035` | 0.001–1 | Engine exponential temperature response rate. |
| `brake_base_c` | `100.0` | 0–200 | Base brake thermal target. |
| `braking_c` | `680.0` | 0–900 | Thermal target increment at full braking. |
| `brake_speed_c_per_mps` | `0.6` | 0–2 | Brake thermal target increment per metre/second. |
| `brake_response_per_second` | `0.09` | 0.001–1 | Brake exponential temperature response rate. |

## sessions

| Field | Default | Bounds | Meaning |
|---|---|---|---|
| `qualifying_reference_laps` | `3.5` | 1–10 | Minimum qualifying duration in reference laps. |
| `practice_minimum_seconds` | `600.0` | 120–1800 | Minimum practice duration before the existing 30-minute cap. |
| `practice_reference_laps` | `7.0` | 1–20 | Practice duration in reference laps before the existing cap. |
| `release_offset_seconds` | `2.0` | 0–30 | Initial autonomous run-release delay. |
| `release_spacing_seconds` | `3.8` | 0.1–20 | Additional autonomous release delay per entry index. |
