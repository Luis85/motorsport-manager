class_name LegacySetupContent
extends RefCounted
## Immutable values for pre-content saves and direct legacy APIs.
const DEFAULTS = {"wing": 5, "balance": 0, "suspension": 5, "cooling": 5, "bias": 56}
const SPECS = {
	"wing": [1, 9, "Wing level", "More cornering support; less straight-line speed."],
	"balance":
	[-3, 3, "Aero balance", "Forward balance helps turn-in; rearward balance supports traction."],
	"suspension":
	[1, 9, "Suspension", "Firm supports dry corners; soft tolerates wet and uneven loading."],
	"cooling": [1, 9, "Cooling aperture", "More airflow reduces engine heat at a drag cost."],
	"bias":
	[52, 62, "Front brake bias %", "Moves braking load between axles. Adjustable during the race."]
}
const EFFECTS = {
	"wing_centre": 5.0,
	"suspension_centre": 5.0,
	"cooling_centre": 5.0,
	"bias_centre": 56.0,
	"balance_gain": 0.016,
	"wheel_balance_gain": 0.34,
	"braking_balance_gain": 0.004,
	"wing_corner_gain": 0.012,
	"suspension_corner_gain": 0.003,
	"wet_suspension_factor": 2.0,
	"corner_balance_loss": 0.12,
	"corner_min": 0.88,
	"corner_max": 1.12,
	"wing_drag_loss": 0.007,
	"cooling_drag_loss": 0.002,
	"wheel_bias_gain": 12.0,
	"wheel_bias_limit": 2.0,
	"bias_brake_loss": 0.01,
	"brake_min": 0.9,
	"suspension_traction_gain": 0.008,
	"balance_traction_loss": 0.25,
	"traction_min": 0.91,
	"traction_max": 1.02
}
const INITIAL = {"engine_c": 85.0, "brake_c": 140.0}
const BASELINES = {
	"balanced": {"wing": 5, "balance": 0, "suspension": 5, "cooling": 5, "bias": 56},
	"low_drag": {"wing": 2, "balance": 0, "suspension": 5, "cooling": 4, "bias": 56},
	"stable_wet": {"wing": 7, "balance": 0, "suspension": 3, "cooling": 6, "bias": 56}
}
