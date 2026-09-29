class_name RaceTuningSchema
extends RefCounted
## Explicit units and supported ranges for implemented model coefficients only.
static func fields() -> Dictionary:
	return {"weather": WeatherTuning.schema(), "surface": SurfaceTuning.schema(),
		"weather_forecast": WeatherForecastTuning.schema(), "model": {"enum": ["path-race-v1"]},
		"fuel": ContentSchema.object({
			"race_load_per_lap": ContentSchema.number(0.5, 1.8),
			"race_reserve_laps": ContentSchema.number(0, 10),
			"qualifying_load_laps": ContentSchema.number(1, 20),
			"practice_load_per_lap": ContentSchema.number(0.5, 2),
			"practice_reserve_laps": ContentSchema.number(0, 10),
			"reduced_rate": ContentSchema.number(0.1, 2),
			"engine_rates": ContentSchema.array(ContentSchema.number(0.1, 3), 3, 3),
			"runtime_mass_factor": ContentSchema.number(0, 0.01),
			"forecast_mass_factor": ContentSchema.number(0, 0.01)
		}),
		"pace": ContentSchema.object({
			"skill_reference": ContentSchema.number(0, 100),
			"skill_factor": ContentSchema.number(0, 0.009),
			"speed_modes": ContentSchema.array(ContentSchema.number(0.5, 1.5), 3, 3),
			"engine_modes": ContentSchema.array(ContentSchema.number(0.5, 1.5), 3, 3),
			"wear_modes": ContentSchema.array(ContentSchema.number(0.1, 3), 3, 3),
			"formation_wear": ContentSchema.number(0.1, 3),
			"forecast_wear_factor": ContentSchema.number(0.5, 2)
		}),
		"service": ContentSchema.object({
			"tyre_base_seconds": ContentSchema.number(0.1, 30),
			"tyre_jitter_seconds": ContentSchema.number(0, 10),
			"repair_base_seconds": ContentSchema.number(0.1, 30),
			"repair_jitter_seconds": ContentSchema.number(0, 10),
			"repair_seconds_per_damage": ContentSchema.number(0, 1),
			"arrival_allowance_seconds": ContentSchema.number(0, 10),
			"transit_allowance_seconds": ContentSchema.number(0, 20),
			"uncertainty_seconds": ContentSchema.number(0.1, 20),
			"queue_uncertainty_seconds": ContentSchema.number(0, 20),
			"warmup_seconds": ContentSchema.number(0, 20)
		}),
		"condition": ContentSchema.object({
			"damage_speed_loss": ContentSchema.number(0, 0.005),
			"health_reference": ContentSchema.number(0, 100),
			"health_speed_loss": ContentSchema.number(0, 0.009),
			"heat_reference_c": ContentSchema.number(80, 160),
			"heat_speed_loss": ContentSchema.number(0, 0.005),
			"health_wear_normal": ContentSchema.number(0, 2),
			"health_wear_attack": ContentSchema.number(0, 3),
			"wear_heat_reference_c": ContentSchema.number(80, 160),
			"wear_heat_factor": ContentSchema.number(0, 0.2),
			"engine_base_c": ContentSchema.number(60, 120),
			"engine_mode_c": ContentSchema.number(0, 15),
			"cooling_reference": ContentSchema.number(1, 9),
			"cooling_c": ContentSchema.number(0, 5),
			"throttle_c": ContentSchema.number(0, 20),
			"water_c": ContentSchema.number(0, 20),
			"engine_response_per_second": ContentSchema.number(0.001, 1),
			"brake_base_c": ContentSchema.number(0, 200),
			"braking_c": ContentSchema.number(0, 900),
			"brake_speed_c_per_mps": ContentSchema.number(0, 2),
			"brake_response_per_second": ContentSchema.number(0.001, 1)
		}),
		"sessions": ContentSchema.object({
			"qualifying_reference_laps": ContentSchema.number(1, 10),
			"practice_minimum_seconds": ContentSchema.number(120, 1800),
			"practice_reference_laps": ContentSchema.number(1, 20),
			"release_offset_seconds": ContentSchema.number(0, 30),
			"release_spacing_seconds": ContentSchema.number(0.1, 20)
		})
	}
