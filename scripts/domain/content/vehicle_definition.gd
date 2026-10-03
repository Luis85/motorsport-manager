class_name VehicleDefinition
extends RefCounted
## Frozen, typed line-solver/vehicle input. Files and UI never mutate this object.
## LEGACY is solely the compatibility input for old saves and direct legacy APIs.
const LEGACY = {
	"Formula": {"top": 89.0, "lat": 24.0, "accel": 9.0, "brake": 17.0, "width": 2.0},
	"GT": {"top": 76.0, "lat": 15.0, "accel": 6.0, "brake": 12.0, "width": 2.1},
	"Touring": {"top": 66.0, "lat": 12.0, "accel": 5.2, "brake": 10.0, "width": 1.9},
	"Kart": {"top": 38.0, "lat": 11.0, "accel": 5.0, "brake": 8.0, "width": 1.4}
}
var id: String:
	get:
		return str(_record.get("id", ""))
var display_name: String:
	get:
		return str(_record.get("name", ""))
var top_speed_mps: float:
	get:
		return float(_parameters.get("top", 0.0))
var braking_mps2: float:
	get:
		return float(_parameters.get("brake", 0.0))
var width_m: float:
	get:
		return float(_parameters.get("width", 0.0))

var _record: Dictionary = {}
var _parameters: Dictionary = {}


static func from_record(record: Dictionary) -> VehicleDefinition:
	if not ContentValidation.check(record, ContentSchema.definition("vehicle")).is_empty():
		return null
	var result = VehicleDefinition.new()
	result._record = RaceStateValue.read_only(record)
	result._parameters = RaceStateValue.read_only(
		{
			"top": float(record.top_speed_mps),
			"lat": float(record.lateral_acceleration_mps2),
			"accel": float(record.acceleration_mps2),
			"brake": float(record.braking_mps2),
			"width": float(record.width_m)
		}
	)
	return result


static func legacy(name: String) -> VehicleDefinition:
	if not LEGACY.has(name):
		return null
	var item = LEGACY[name]
	return from_record(
		{
			"kind": "vehicle",
			"schema_version": 1,
			"id": "core.vehicle." + name.to_lower(),
			"name": name,
			"description": "Legacy compatibility vehicle; frozen pre-content contract.",
			"top_speed_mps": item.top,
			"lateral_acceleration_mps2": item.lat,
			"acceleration_mps2": item.accel,
			"braking_mps2": item.brake,
			"width_m": item.width
		}
	)


func to_record() -> Dictionary:
	return _record.duplicate(true)


func parameters() -> Dictionary:
	return _parameters
