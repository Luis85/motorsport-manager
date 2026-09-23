class_name TrackDocument
extends RefCounted
## Versioned authoring data. Coordinates are metres, +Y north and +height up.
const FORMAT = "motorsport-manager-track"
const VERSION = 1
const MAX_NODES = 2000

static func node_at(p: Vector2, width: float = 14.0) -> Dictionary:
	return {"id": "n-%s" % Time.get_ticks_usec(), "x": p.x, "y": p.y, "h": 0.0, "w": width, "bank": 0.0, "mode": "aligned", "in": {"x": 0.0, "y": 0.0}, "out": {"x": 0.0, "y": 0.0}}

static func point(n: Dictionary) -> Vector2:
	return Vector2(float(n.x), float(n.y))

static func handle(n: Dictionary, key: String) -> Vector2:
	var h = n.get(key, {})
	return Vector2(float(h.get("x", 0)), float(h.get("y", 0)))

static func set_handle(n: Dictionary, key: String, v: Vector2) -> void:
	n[key] = {"x": v.x, "y": v.y}
	if n.get("mode", "aligned") == "aligned":
		var other = "in" if key == "out" else "out"
		var length = handle(n, other).length()
		n[other] = {"x": -v.normalized().x * length, "y": -v.normalized().y * length}

static func normalize(raw: Dictionary) -> Dictionary:
	var d = raw.duplicate(true)
	d.kind = FORMAT
	d.version = VERSION
	d["name"] = str(d.get("name", "Untitled circuit")).strip_edges().left(100)
	d.id = str(d.get("id", "custom-" + JSON.stringify(d.get("nodes", [])).sha256_text().left(16)))
	d.closed = d.get("closed", true)
	d.start = float(d.get("start", 0))
	for key in ["features", "pits", "objects", "timingGates", "cornerMarkers"]:
		d[key] = d.get(key, [])
	d.provenance = d.get("provenance", {})
	d.visual = d.get("visual", {}).duplicate(true)
	d.visual.merge({"environment": "meadow", "season": "summer", "seed": abs(int(d.id.hash())) % 1000000})
	d.grid = d.get("grid", {"count": 12, "spacing": 8.0})
	var normalized: Array = []
	var missing: Array = []
	for i in range(d.get("nodes", []).size()):
		var n = d.nodes[i]
		missing.append([not n.has("in"), not n.has("out")] if n is Dictionary else [false, false])
		if n is Array and n.size() >= 9:
			n = {"id": "n-%d" % i, "x": n[0], "y": n[1], "h": n[2], "w": n[3], "bank": n[4], "in": {"x": n[5], "y": n[6]}, "out": {"x": n[7], "y": n[8]}, "mode": "free"}
		elif n is Dictionary:
			n = n.duplicate(true)
			var base = node_at(point(n))
			for k in base:
				if not n.has(k): n[k] = base[k]
		else: continue
		normalized.append(n)
	d.nodes = normalized
	# Circuit Atelier automatic handles use centripetal Catmull–Rom, not uniform smoothing.
	if normalized.size() >= 4:
		for i in range(normalized.size()):
			var a = point(normalized[i]); var b = point(normalized[(i + 1) % normalized.size()])
			var before = point(normalized[posmod(i - 1, normalized.size())]); var after = point(normalized[(i + 2) % normalized.size()])
			var p = centripetal(before, a, b, after, 1.0 / 3); var q = centripetal(before, a, b, after, 2.0 / 3)
			var r1 = p * 27 - a * 8 - b; var r2 = q * 27 - a - b * 8
			if missing[i][1]:
				var h = (r1 * 2 - r2) / 18 - a
				normalized[i]["out"] = {"x": h.x, "y": h.y}
			var j = (i + 1) % normalized.size()
			if missing[j][0]:
				var h = (r2 * 2 - r1) / 18 - b
				normalized[j]["in"] = {"x": h.x, "y": h.y}
	return d

static func centripetal(p0: Vector2, p1: Vector2, p2: Vector2, p3: Vector2, t: float) -> Vector2:
	var t1 = sqrt(maxf(p0.distance_to(p1), 0.001))
	var t2 = t1 + sqrt(maxf(p1.distance_to(p2), 0.001))
	var t3 = t2 + sqrt(maxf(p2.distance_to(p3), 0.001))
	var u = lerpf(t1, t2, t)
	var a = p0.lerp(p1, u / t1); var b = p1.lerp(p2, (u - t1) / (t2 - t1)); var c = p2.lerp(p3, (u - t2) / (t3 - t2))
	return a.lerp(b, u / t2).lerp(b.lerp(c, (u - t1) / (t3 - t1)), (u - t1) / (t2 - t1))

static func validate(raw: Variant) -> Array[String]:
	var errors: Array[String] = []
	if not raw is Dictionary: return ["The file must contain a track object."]
	if raw.get("kind", FORMAT) not in [FORMAT, "circuit-atelier-project"]:
		return ["Unsupported file type. Import an authoring track, not a runtime export."]
	var version = raw.get("version", 1)
	if typeof(version) not in [TYPE_FLOAT, TYPE_INT] or version < 1 or version > (4 if raw.get("kind") == "circuit-atelier-project" else VERSION):
		return ["Unsupported track version."]
	if not raw.get("nodes") is Array or raw.nodes.size() < 4 or raw.nodes.size() > MAX_NODES:
		return ["A circuit needs 4–2000 control points."]
	if not raw.get("closed", true) is bool: return ["Closed must be a boolean."]
	if not raw.get("closed", true): errors.append("Close the circuit before racing.")
	for key in ["grid", "provenance"]:
		if not raw.get(key, {}) is Dictionary: return ["Invalid %s object." % key]
	if not valid_number(raw.get("grid", {}).get("spacing", 8), 6, 20): return ["Grid spacing must be 6–20 metres."]
	if not raw.get("name", "") is String or str(raw.get("name", "")).strip_edges().is_empty(): errors.append("Give the circuit a name.")
	if raw.has("visual"):
		var visual = raw.visual
		if not visual is Dictionary: return ["Invalid visual settings."]
		if visual.get("environment", "meadow") not in ["meadow", "woodland", "coastal"] or visual.get("season", "summer") not in ["summer", "autumn"]: return ["Unsupported circuit illustration style."]
		if not valid_number(visual.get("seed", 1975), 0, 1000000) or visual.get("seed", 1975) != floor(visual.get("seed", 1975)): return ["Invalid scenery seed."]
	var distinct: Dictionary = {}
	var polygon: Array = []
	for n in raw.nodes:
		if not n is Dictionary and not (n is Array and n.size() >= 9): return ["Invalid control point."]
		var vals = n if n is Array else [n.get("x"), n.get("y"), n.get("h", 0), n.get("w", 14), n.get("bank", 0)]
		for v in vals:
			if typeof(v) not in [TYPE_FLOAT, TYPE_INT] or not is_finite(float(v)) or abs(float(v)) > 100000:
				return ["Coordinates must be finite numbers within ±100 km."]
		var p = Vector2(vals[0], vals[1])
		distinct["%.3f,%.3f" % [p.x, p.y]] = true
		polygon.append(p)
		if float(vals[3]) < 5 or float(vals[3]) > 40: return ["Track width must be between 5 and 40 metres."]
		if abs(float(vals[4])) > 45: return ["Banking must be within ±45 degrees."]
		if n is Dictionary:
			for key in ["in", "out"]:
				var h = n.get(key, {"x": 0, "y": 0})
				if not h is Dictionary: return ["Invalid Bezier handle."]
				for axis in ["x", "y"]:
					var v = h.get(axis, 0)
					if typeof(v) not in [TYPE_FLOAT, TYPE_INT] or not is_finite(v) or abs(v) > 10000: return ["Invalid Bezier handle coordinates."]
	if distinct.size() < 4: errors.append("A circuit needs four distinct points.")
	var perimeter = 0.0
	for i in range(polygon.size()): perimeter += polygon[i].distance_to(polygon[(i + 1) % polygon.size()])
	if perimeter < 100: errors.append("The control polygon must span at least 100 metres.")
	for key in ["start"]:
		var v = raw.get(key, 0)
		if typeof(v) not in [TYPE_FLOAT, TYPE_INT] or not is_finite(v) or v < 0 or v >= 1: errors.append("Start/finish must be a fraction from 0 to less than 1.")
	for key in ["pits", "features", "objects", "timingGates", "cornerMarkers"]:
		if not raw.get(key, []) is Array or raw.get(key, []).size() > 2000: return ["Invalid or excessive %s." % key]
	for p in raw.get("pits", []):
		if not p is Dictionary or not p.get("nodes", []) is Array: return ["Invalid pit lane."]
		for key in ["entry", "exit"]:
			var v = p.get(key, -1)
			if typeof(v) not in [TYPE_FLOAT, TYPE_INT] or not is_finite(v) or v < 0 or v >= 1: return ["Invalid pit entry or exit."]
		if p.nodes.size() > 2000: return ["Too many pit points."]
		if not valid_number(p.get("speed", 80), 30, 100): return ["Pit speed must be 30–100 km/h."]
		if is_equal_approx(p.entry, p.exit): return ["Pit entry and exit must differ."]
		for n in p.nodes:
			if not n is Dictionary: return ["Invalid pit point."]
			if not valid_number(n.get("h", 0), -1000, 10000): return ["Invalid pit elevation."]
			for key in ["x", "y"]:
				var v = n.get(key)
				if typeof(v) not in [TYPE_FLOAT, TYPE_INT] or not is_finite(v) or abs(v) > 100000: return ["Invalid pit coordinate."]
	for f in raw.get("features", []):
		if not f is Dictionary: return ["Invalid track feature."]
		if not f.get("type", "curb") is String: return ["Invalid feature type."]
		if not valid_number(f.get("width", 1), 0.05, 100) or not valid_number(f.get("clearance", 5), 0, 100): return ["Invalid feature dimensions."]
		for key in ["a", "b"]:
			var v = f.get(key, 0)
			if typeof(v) not in [TYPE_FLOAT, TYPE_INT] or not is_finite(v) or v < 0 or v > 1: return ["Invalid feature range."]
	for o in raw.get("objects", []):
		if not o is Dictionary: return ["Invalid scenery object."]
		for key in ["x", "y", "rotation", "scale"]:
			var v = o.get(key, 0 if key != "scale" else 1)
			if typeof(v) not in [TYPE_FLOAT, TYPE_INT] or not is_finite(v) or abs(v) > 100000: return ["Invalid scenery coordinates."]
	for gate in raw.get("timingGates", []):
		if not gate is Dictionary or not valid_number(gate.get("f", 0), 0, 1): return ["Invalid timing gate."]
	for marker in raw.get("cornerMarkers", []):
		if not marker is Dictionary: return ["Invalid corner marker."]
		for key in ["x", "y"]:
			if marker.has(key) and not valid_number(marker[key], -100000, 100000): return ["Invalid marker coordinate."]
	if raw.has("reference"):
		var ref = raw.reference
		if not ref is Dictionary or not ref.get("png", "") is String or ref.get("png", "").length() > 11000000: return ["Invalid or oversized reference image."]
		if not valid_number(ref.get("width", 0), 1, 20000) or not valid_number(ref.get("opacity", 0.35), 0, 1): return ["Invalid reference-image calibration."]
		if not valid_number(ref.get("x", 0), -100000, 100000) or not valid_number(ref.get("y", 0), -100000, 100000): return ["Invalid reference-image position."]
	return errors

static func valid_number(value: Variant, low: float, high: float) -> bool:
	return typeof(value) in [TYPE_FLOAT, TYPE_INT] and is_finite(float(value)) and float(value) >= low and float(value) <= high

static func split_segment(d: Dictionary, i: int, t: float = 0.5) -> int:
	var a = d.nodes[i]
	var b = d.nodes[(i + 1) % d.nodes.size()]
	var p0 = point(a)
	var p1 = p0 + handle(a, "out")
	var p3 = point(b)
	var p2 = p3 + handle(b, "in")
	var q0 = p0.lerp(p1, t)
	var q1 = p1.lerp(p2, t)
	var q2 = p2.lerp(p3, t)
	var r0 = q0.lerp(q1, t)
	var r1 = q1.lerp(q2, t)
	var p = r0.lerp(r1, t)
	var n = node_at(p, lerpf(a.w, b.w, t))
	n.h = lerpf(a.h, b.h, t)
	n.bank = lerpf(a.bank, b.bank, t)
	n.mode = "free"
	a.mode = "free"
	b.mode = "free"
	set_handle(a, "out", q0 - p0)
	set_handle(b, "in", q2 - p3)
	set_handle(n, "in", r0 - p)
	set_handle(n, "out", r1 - p)
	d.nodes.insert(i + 1, n)
	return i + 1

static func smooth_node(d: Dictionary, i: int) -> void:
	var n = d.nodes[i]
	var prev = point(d.nodes[posmod(i - 1, d.nodes.size())])
	var next = point(d.nodes[(i + 1) % d.nodes.size()])
	var direction = (next - prev).normalized()
	n.mode = "free"
	set_handle(n, "in", -direction * point(n).distance_to(prev) * 0.25)
	set_handle(n, "out", direction * point(n).distance_to(next) * 0.25)
	n.mode = "aligned"
