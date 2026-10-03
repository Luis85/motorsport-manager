class_name TyreOperatingSchema
extends RefCounted
## Optional four-wheel operating rails, distinct from serialization/safety bounds.
const LEGACY = {
	"moving_threshold_mps": 1.0,
	"reference_brake_bias": 0.56,
	"corner_saturation": 1.5,
	"slide_saturation": 1.5,
	"minimum_load": 0.55,
	"maximum_load": 1.7,
	"minimum_pressure": 0.8,
	"maximum_pressure": 1.32,
	"surface_limit_c": 160.0,
	"core_limit_c": 155.0,
	"lockup_front_bias": 0.56
}
const BOUNDS = {
	"moving_threshold_mps": [0.0, 20.0],
	"reference_brake_bias": [0.25, 0.75],
	"corner_saturation": [0.1, 4.0],
	"slide_saturation": [0.1, 4.0],
	"minimum_load": [0.05, 4.0],
	"maximum_load": [0.05, 4.0],
	"minimum_pressure": [0.5, 1.0],
	"maximum_pressure": [1.0, 2.0],
	"surface_limit_c": [100.0, 200.0],
	"core_limit_c": [100.0, 200.0],
	"lockup_front_bias": [0.25, 0.75]
}


static func definition() -> Dictionary:
	var properties: Dictionary = {}
	for key in BOUNDS:
		properties[key] = ContentSchema.number(BOUNDS[key][0], BOUNDS[key][1])
	return ContentSchema.object(properties)


static func valid(value: Variant) -> bool:
	if not ContentValidation.check(value, definition()).is_empty():
		return false
	return value.minimum_load <= value.maximum_load and value.core_limit_c <= value.surface_limit_c
