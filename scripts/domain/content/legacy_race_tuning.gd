class_name LegacyRaceTuning
extends RefCounted
## Immutable pre-externalization values for old saves and direct compatibility APIs.
## New authored sessions resolve config/race_tuning/default.json instead.
const VALUES = {
	"fuel":
	{
		"race_load_per_lap": 1.13,
		"race_reserve_laps": 1.5,
		"qualifying_load_laps": 4.0,
		"practice_load_per_lap": 1.14,
		"practice_reserve_laps": 3.0,
		"reduced_rate": 0.6,
		"engine_rates": [0.84, 1.0, 1.14],
		"runtime_mass_factor": 0.0007,
		"forecast_mass_factor": 0.00035
	},
	"pace":
	{
		"skill_reference": 85.0,
		"skill_factor": 0.002,
		"speed_modes": [0.988, 1.0, 1.01],
		"engine_modes": [0.974, 1.0, 1.014],
		"wear_modes": [0.78, 1.0, 1.25],
		"formation_wear": 0.55,
		"forecast_wear_factor": 1.05
	},
	"service":
	{
		"tyre_base_seconds": 3.0,
		"tyre_jitter_seconds": 1.5,
		"repair_base_seconds": 2.0,
		"repair_jitter_seconds": 1.0,
		"repair_seconds_per_damage": 0.14,
		"arrival_allowance_seconds": 1.5,
		"transit_allowance_seconds": 3.0,
		"uncertainty_seconds": 2.25,
		"queue_uncertainty_seconds": 2.0,
		"warmup_seconds": 1.5
	},
	"condition":
	{
		"damage_speed_loss": 0.003,
		"health_reference": 65.0,
		"health_speed_loss": 0.002,
		"heat_reference_c": 115.0,
		"heat_speed_loss": 0.003,
		"health_wear_normal": 0.4,
		"health_wear_attack": 0.65,
		"wear_heat_reference_c": 112.0,
		"wear_heat_factor": 0.04,
		"engine_base_c": 91.0,
		"engine_mode_c": 8.0,
		"cooling_reference": 5.0,
		"cooling_c": 3.0,
		"throttle_c": 12.0,
		"water_c": 8.0,
		"engine_response_per_second": 0.035,
		"brake_base_c": 100.0,
		"braking_c": 680.0,
		"brake_speed_c_per_mps": 0.6,
		"brake_response_per_second": 0.09
	},
	"sessions":
	{
		"qualifying_reference_laps": 3.5,
		"practice_minimum_seconds": 600.0,
		"practice_reference_laps": 7.0,
		"release_offset_seconds": 2.0,
		"release_spacing_seconds": 3.8
	}
}
