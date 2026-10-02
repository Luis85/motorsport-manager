class_name RacePerformanceProfile
extends RefCounted
## Frozen per-car capability multipliers. Geometry remains track-owned.
const VERSION = 1
const BASE_BPS = 10000
const MIN_BPS = 9000
const MAX_BPS = 11000
const DELTA_LIMIT = 1000
const KEYS = ["top", "lat", "accel", "brake"]
const MAX_SOURCES = 16
const MAX_SOURCE_LENGTH = 96

static func baseline() -> Dictionary:
	return build({"top": 0, "lat": 0, "accel": 0, "brake": 0}, [])

static func build(delta_bps: Dictionary, source_ids: Array = []) -> Dictionary:
	var data = {"version": VERSION, "top_bps": BASE_BPS, "lat_bps": BASE_BPS,
		"accel_bps": BASE_BPS, "brake_bps": BASE_BPS,
		"source_ids": source_ids.duplicate(true)}
	for key in KEYS:
		var delta = delta_bps.get(key, 0)
		if not RaceCheckpoint.integral(delta, -DELTA_LIMIT, DELTA_LIMIT):
			return {}
		data[key + "_bps"] = BASE_BPS + int(delta)
	data["digest"] = RaceStateValue.fingerprint(data)
	return data if validate(data).is_empty() else {}

static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Race performance profile exceeds serialized-value limits."
	if not data is Dictionary or data.size() != 7 			or not RaceCheckpoint.integral(data.get("version"), VERSION, VERSION):
		return "Race performance profile has an unsupported shape or version."
	for key in KEYS:
		if not RaceCheckpoint.integral(data.get(key + "_bps"), MIN_BPS, MAX_BPS):
			return "Race performance profile has an invalid " + key + " capability."
	if not data.get("source_ids") is Array or data.source_ids.size() > MAX_SOURCES:
		return "Race performance profile has an invalid source list."
	var seen = {}
	for source_id in data.source_ids:
		if not _valid_id(source_id) or seen.has(source_id):
			return "Race performance profile has an invalid or repeated source identity."
		seen[source_id] = true
	var content = data.duplicate(true)
	content.erase("digest")
	if not _valid_hash(data.get("digest")) or data.digest != RaceStateValue.fingerprint(content):
		return "Race performance profile integrity check failed."
	return ""

static func validate_set(value: Variant, count: int) -> String:
	if not value is Array or value.size() != count:
		return "Race performance profiles must cover every entrant exactly once."
	for profile in value:
		var error = validate(profile)
		if not error.is_empty():
			return error
	return ""

static func limits(profile: Dictionary, vehicle: VehicleDefinition) -> Dictionary:
	if vehicle == null or not validate(profile).is_empty():
		return {}
	var base = vehicle.parameters()
	return {"top": base.top * _factor(profile, "top"),
		"lat": base.lat * _factor(profile, "lat"),
		"accel": base.accel * _factor(profile, "accel"),
		"brake": base.brake * _factor(profile, "brake")}

static func line_factor(profile: Dictionary, curvature: float) -> float:
	if not validate(profile).is_empty():
		return 1.0
	var straight = (_factor(profile, "top") + _factor(profile, "accel")) * 0.5
	var corner = (_factor(profile, "lat") + _factor(profile, "brake")) * 0.5
	return lerpf(straight, corner, clampf(absf(curvature) * 100.0, 0.0, 1.0))

static func forecast_lap_factor(profile: Dictionary) -> float:
	if not validate(profile).is_empty():
		return 1.0
	var capability = 0.30 * _factor(profile, "top") + 0.20 * _factor(profile, "accel") 		+ 0.35 * _factor(profile, "lat") + 0.15 * _factor(profile, "brake")
	return 1.0 / maxf(0.85, capability)

static func _factor(profile: Dictionary, key: String) -> float:
	return float(profile[key + "_bps"]) / BASE_BPS

static func _valid_id(value: Variant) -> bool:
	if not value is String or value.is_empty() or value.length() > MAX_SOURCE_LENGTH:
		return false
	for character in value:
		if character not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-":
			return false
	return true

static func _valid_hash(value: Variant) -> bool:
	return value is String and value.length() == 64 and value.is_valid_hex_number(false)
