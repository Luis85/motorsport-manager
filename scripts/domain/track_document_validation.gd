extends RefCounted
## Versioned authoring data. Coordinates are metres, +Y north and +height up.
const FORMAT = "motorsport-manager-track"
const VERSION = 1
const MAX_NODES = 2000
const MAX_GRID_PLACES = 64
## Bounded authored-point, pit, scenery and reference-image schema checks.


static func _visual_errors(raw: Dictionary) -> Array[String]:
	if raw.has("visual"):
		var visual = raw.visual
		if not visual is Dictionary:
			return ["Invalid visual settings."]
		if (
			visual.get("environment", "meadow") not in ["meadow", "woodland", "coastal"]
			or visual.get("season", "summer") not in ["summer", "autumn"]
		):
			return ["Unsupported circuit illustration style."]
		if (
			not valid_number(visual.get("seed", 1975), 0, 1000000)
			or visual.get("seed", 1975) != floor(visual.get("seed", 1975))
		):
			return ["Invalid scenery seed."]
	return []


static func _point_coordinate_errors(n: Variant) -> Array[String]:
	if not n is Dictionary and not (n is Array and n.size() >= 9):
		return ["Invalid control point."]
	var vals = (
		n
		if n is Array
		else [n.get("x"), n.get("y"), n.get("h", 0), n.get("w", 14), n.get("bank", 0)]
	)
	for v in vals:
		if (
			typeof(v) not in [TYPE_FLOAT, TYPE_INT]
			or not is_finite(float(v))
			or abs(float(v)) > 100000
		):
			return ["Coordinates must be finite numbers within ±100 km."]
	return []


static func _point_shape_errors(n: Variant, vals: Array) -> Array[String]:
	if float(vals[3]) < 5 or float(vals[3]) > 40:
		return ["Track width must be between 5 and 40 metres."]
	if abs(float(vals[4])) > 45:
		return ["Banking must be within ±45 degrees."]
	if n is Dictionary:
		for key in ["in", "out"]:
			var h = n.get(key, {"x": 0, "y": 0})
			if not h is Dictionary:
				return ["Invalid Bezier handle."]
			for axis in ["x", "y"]:
				var v = h.get(axis, 0)
				if typeof(v) not in [TYPE_FLOAT, TYPE_INT] or not is_finite(v) or abs(v) > 10000:
					return ["Invalid Bezier handle coordinates."]
	return []


static func _pit_errors(raw: Dictionary) -> Array[String]:
	for p in raw.get("pits", []):
		if not p is Dictionary or not p.get("nodes") is Array:
			return ["Invalid pit lane."]
		for key in ["entry", "exit"]:
			var v = p.get(key, -1)
			if typeof(v) not in [TYPE_FLOAT, TYPE_INT] or not is_finite(v) or v < 0 or v >= 1:
				return ["Invalid pit entry or exit."]
		if p.nodes.size() > 2000:
			return ["Too many pit points."]
		if not valid_number(p.get("speed", 80), 30, 100):
			return ["Pit speed must be 30–100 km/h."]
		if is_equal_approx(p.entry, p.exit):
			return ["Pit entry and exit must differ."]
		for n in p.nodes:
			if not n is Dictionary:
				return ["Invalid pit point."]
			if not valid_number(n.get("h", 0), -1000, 10000):
				return ["Invalid pit elevation."]
			for key in ["x", "y"]:
				var v = n.get(key)
				if typeof(v) not in [TYPE_FLOAT, TYPE_INT] or not is_finite(v) or abs(v) > 100000:
					return ["Invalid pit coordinate."]
	return []


static func _feature_errors(raw: Dictionary) -> Array[String]:
	for f in raw.get("features", []):
		if not f is Dictionary:
			return ["Invalid track feature."]
		if not f.get("type", "curb") is String:
			return ["Invalid feature type."]
		if (
			not valid_number(f.get("width", 1), 0.05, 100)
			or not valid_number(f.get("clearance", 5), 0, 100)
		):
			return ["Invalid feature dimensions."]
		for key in ["a", "b"]:
			var v = f.get(key, 0)
			if typeof(v) not in [TYPE_FLOAT, TYPE_INT] or not is_finite(v) or v < 0 or v > 1:
				return ["Invalid feature range."]
	return []


static func _scenery_timing_errors(raw: Dictionary) -> Array[String]:
	for o in raw.get("objects", []):
		if not o is Dictionary:
			return ["Invalid scenery object."]
		if not o.get("group", "") is String or o.get("group", "").length() > 80:
			return ["Invalid scenery group identifier."]
		for key in ["x", "y", "rotation", "scale"]:
			var v = o.get(key, 0 if key != "scale" else 1)
			if typeof(v) not in [TYPE_FLOAT, TYPE_INT] or not is_finite(v) or abs(v) > 100000:
				return ["Invalid scenery coordinates."]
	for gate in raw.get("timingGates", []):
		if not gate is Dictionary or not valid_number(gate.get("f", 0), 0, 1):
			return ["Invalid timing gate."]
	for marker in raw.get("cornerMarkers", []):
		if not marker is Dictionary:
			return ["Invalid corner marker."]
		for key in ["x", "y"]:
			if marker.has(key) and not valid_number(marker[key], -100000, 100000):
				return ["Invalid marker coordinate."]
	return []


static func _reference_errors(raw: Dictionary) -> Array[String]:
	if raw.has("reference"):
		var ref = raw.reference
		if (
			not ref is Dictionary
			or not ref.get("png", "") is String
			or ref.get("png", "").length() > 11000000
		):
			return ["Invalid or oversized reference image."]
		if (
			not valid_number(ref.get("width", 0), 1, 20000)
			or not valid_number(ref.get("opacity", 0.35), 0, 1)
		):
			return ["Invalid reference-image calibration."]
		if (
			not valid_number(ref.get("x", 0), -100000, 100000)
			or not valid_number(ref.get("y", 0), -100000, 100000)
		):
			return ["Invalid reference-image position."]
	return []


static func valid_number(value: Variant, low: float, high: float) -> bool:
	return (
		typeof(value) in [TYPE_FLOAT, TYPE_INT]
		and is_finite(float(value))
		and float(value) >= low
		and float(value) <= high
	)
