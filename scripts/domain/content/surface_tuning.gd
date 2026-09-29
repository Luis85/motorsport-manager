class_name SurfaceTuning
extends RefCounted
## Frozen v1 compatibility values and explicit authoring bounds for surface.
## Runtime consumers receive already validated, read-only parameter tables.
const DEFAULTS = {
	"initial_dust": 0.11,
	"edge_dust_per_lane": 0.014,
	"initial_marbles": 0.012,
	"initial_wet_threshold": 0.1,
	"initial_wet_c": 20.0,
	"initial_dry_c": 29.0,
	"rubber_grip_gain": 0.17,
	"wet_rubber_threshold": 0.2,
	"wet_rubber_grip_loss": 0.1,
	"dust_grip_loss": 0.13,
	"marbles_grip_loss": 0.17,
	"debris_grip_loss": 0.14,
	"oil_grip_loss": 0.43,
	"base_grip": 0.96,
	"water_grip_loss": 0.3,
	"water_squared_grip_loss": 0.13,
	"minimum_grip": 0.3,
	"maximum_grip": 1.14,
	"lateral_exchange_rate": 0.02,
	"camber_flow_gain": 0.2,
	"water_flow_gain": 0.08,
	"local_rain_base": 0.85,
	"local_rain_amplitude": 0.3,
	"rain_station_phase": 0.077,
	"rain_time_phase": 0.002,
	"minimum_local_rain": 0.5,
	"maximum_local_rain": 1.2,
	"minimum_drainage": 0.15,
	"camber_drainage_gain": 2.0,
	"evaporation_base": 0.00046,
	"evaporation_reference_c": 15.0,
	"evaporation_heat_gain": 1.8e-05,
	"rain_collection_rate": 0.008,
	"drainage_rate": 0.0015,
	"drainage_base": 0.22,
	"rain_wet_threshold": 0.1,
	"wet_evaporation_multiplier": 0.18,
	"rubber_rain_wash": 0.00155,
	"rubber_water_wash": 5e-05,
	"dust_rain_wash": 0.00027,
	"marbles_rain_wash": 0.00015,
	"oil_rain_wash": 0.00014,
	"oil_decay": 0.00015,
	"debris_decay": 0.00022,
	"wet_target_c": 19.0,
	"dry_target_c": 32.0,
	"temperature_response_per_second": 0.006,
	"contact_width_lanes": 0.65,
	"minimum_contact_weight": 0.004,
	"rubber_deposit": 0.009,
	"wet_tyre_displacement": 0.021,
	"dry_tyre_displacement": 0.013,
	"dust_sweep": 0.021,
	"marbles_sweep": 0.005,
	"maximum_temperature_c": 80.0,
	"contact_heating_c": 0.022,
	"braking_heating_c": 0.06,
	"marbles_deposit": 0.004,
	"push_marbles_multiplier": 1.4,
	"debris_spread_multiplier": 0.35,
	"incident_oil_deposit": 0.42
}

static func schema() -> Dictionary:
	return ContentSchema.object({
		"initial_dust": ContentSchema.number(0, 1),
		"edge_dust_per_lane": ContentSchema.number(0, 0.3),
		"initial_marbles": ContentSchema.number(0, 1),
		"initial_wet_threshold": ContentSchema.number(0, 1),
		"initial_wet_c": ContentSchema.number(0, 80),
		"initial_dry_c": ContentSchema.number(0, 80),
		"rubber_grip_gain": ContentSchema.number(0, 1),
		"wet_rubber_threshold": ContentSchema.number(0, 1),
		"wet_rubber_grip_loss": ContentSchema.number(0, 1),
		"dust_grip_loss": ContentSchema.number(0, 1),
		"marbles_grip_loss": ContentSchema.number(0, 1),
		"debris_grip_loss": ContentSchema.number(0, 1),
		"oil_grip_loss": ContentSchema.number(0, 1),
		"base_grip": ContentSchema.number(0.1, 1.5),
		"water_grip_loss": ContentSchema.number(0, 1),
		"water_squared_grip_loss": ContentSchema.number(0, 1),
		"minimum_grip": ContentSchema.number(0.05, 1),
		"maximum_grip": ContentSchema.number(0.1, 1.5),
		"lateral_exchange_rate": ContentSchema.number(0, 0.2),
		"camber_flow_gain": ContentSchema.number(0, 1),
		"water_flow_gain": ContentSchema.number(0, 1),
		"local_rain_base": ContentSchema.number(0, 2),
		"local_rain_amplitude": ContentSchema.number(0, 2),
		"rain_station_phase": ContentSchema.number(0, 6.3),
		"rain_time_phase": ContentSchema.number(0, 0.1),
		"minimum_local_rain": ContentSchema.number(0, 2),
		"maximum_local_rain": ContentSchema.number(0, 2),
		"minimum_drainage": ContentSchema.number(0.01, 2),
		"camber_drainage_gain": ContentSchema.number(0, 10),
		"evaporation_base": ContentSchema.number(0, 0.01),
		"evaporation_reference_c": ContentSchema.number(0, 80),
		"evaporation_heat_gain": ContentSchema.number(0, 0.001),
		"rain_collection_rate": ContentSchema.number(0, 0.1),
		"drainage_rate": ContentSchema.number(0, 0.1),
		"drainage_base": ContentSchema.number(0, 2),
		"rain_wet_threshold": ContentSchema.number(0, 2),
		"wet_evaporation_multiplier": ContentSchema.number(0, 1),
		"rubber_rain_wash": ContentSchema.number(0, 0.1),
		"rubber_water_wash": ContentSchema.number(0, 0.1),
		"dust_rain_wash": ContentSchema.number(0, 0.1),
		"marbles_rain_wash": ContentSchema.number(0, 0.1),
		"oil_rain_wash": ContentSchema.number(0, 0.1),
		"oil_decay": ContentSchema.number(0, 0.1),
		"debris_decay": ContentSchema.number(0, 0.1),
		"wet_target_c": ContentSchema.number(0, 80),
		"dry_target_c": ContentSchema.number(0, 80),
		"temperature_response_per_second": ContentSchema.number(0, 1),
		"contact_width_lanes": ContentSchema.number(0.1, 2),
		"minimum_contact_weight": ContentSchema.number(0, 0.5),
		"rubber_deposit": ContentSchema.number(0, 0.1),
		"wet_tyre_displacement": ContentSchema.number(0, 0.2),
		"dry_tyre_displacement": ContentSchema.number(0, 0.2),
		"dust_sweep": ContentSchema.number(0, 0.2),
		"marbles_sweep": ContentSchema.number(0, 0.2),
		"maximum_temperature_c": ContentSchema.number(1, 100),
		"contact_heating_c": ContentSchema.number(0, 1),
		"braking_heating_c": ContentSchema.number(0, 2),
		"marbles_deposit": ContentSchema.number(0, 0.2),
		"push_marbles_multiplier": ContentSchema.number(1, 5),
		"debris_spread_multiplier": ContentSchema.number(0, 1),
		"incident_oil_deposit": ContentSchema.number(0, 1)
	})

static func problem(p: Dictionary) -> Dictionary:
	if p.initial_dust + 3 * p.edge_dust_per_lane > 1:
		return issue("/edge_dust_per_lane", "Initial dust plus three edge-strip increments must not exceed 1.")
	if p.minimum_grip > p.maximum_grip:
		return issue("/maximum_grip", "Maximum grip must be at least the minimum grip.")
	if p.minimum_local_rain > p.maximum_local_rain:
		return issue("/maximum_local_rain", "Maximum local rain must be at least its minimum.")
	for field in ["initial_wet_c", "initial_dry_c", "wet_target_c", "dry_target_c"]:
		if p[field] < p.evaporation_reference_c or p[field] > p.maximum_temperature_c:
			return issue("/" + field, "Surface temperature must lie between the evaporation reference and maximum temperature.")
	return {}

static func coherent(p: Dictionary) -> bool:
	return problem(p).is_empty()

static func issue(field: String, message: String) -> Dictionary:
	return ContentValidation.diagnostic("CONTENT_TUNING", field, message)
