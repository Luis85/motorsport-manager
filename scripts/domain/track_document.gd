class_name TrackDocument
extends "res://scripts/domain/track_document_validation.gd"


static func node_at(p: Vector2, width: float = 14.0, identity: String = "") -> Dictionary:
	# Content-derived fallback is deterministic. Editing commands supply a document-local ID.
	var node_id = (
		identity
		if not identity.is_empty()
		else "point-" + JSON.stringify([p.x, p.y, width]).sha256_text().left(16)
	)
	return {
		"id": node_id,
		"x": p.x,
		"y": p.y,
		"h": 0.0,
		"w": width,
		"bank": 0.0,
		"mode": "aligned",
		"in": {"x": 0.0, "y": 0.0},
		"out": {"x": 0.0, "y": 0.0}
	}


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
	d.visual.merge(
		{"environment": "meadow", "season": "summer", "seed": abs(int(d.id.hash())) % 1000000}
	)
	d.grid = d.get("grid", {"count": 12, "spacing": 8.0})
	var normalized: Array = []
	var missing: Array = []
	for i in range(d.get("nodes", []).size()):
		var n = d.nodes[i]
		missing.append([not n.has("in"), not n.has("out")] if n is Dictionary else [false, false])
		if n is Array and n.size() >= 9:
			n = {
				"id": "n-%d" % i,
				"x": n[0],
				"y": n[1],
				"h": n[2],
				"w": n[3],
				"bank": n[4],
				"in": {"x": n[5], "y": n[6]},
				"out": {"x": n[7], "y": n[8]},
				"mode": "free"
			}
		elif n is Dictionary:
			n = n.duplicate(true)
			var base = node_at(point(n), 14.0, "n-%d" % i)
			for k in base:
				if not n.has(k):
					n[k] = base[k]
		else:
			continue
		normalized.append(n)
	d.nodes = normalized
	# Circuit Atelier automatic handles use centripetal Catmull–Rom, not uniform smoothing.
	if normalized.size() >= 4:
		for i in range(normalized.size()):
			var a = point(normalized[i])
			var b = point(normalized[(i + 1) % normalized.size()])
			var before = point(normalized[posmod(i - 1, normalized.size())])
			var after = point(normalized[(i + 2) % normalized.size()])
			var p = centripetal(before, a, b, after, 1.0 / 3)
			var q = centripetal(before, a, b, after, 2.0 / 3)
			var r1 = p * 27 - a * 8 - b
			var r2 = q * 27 - a - b * 8
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
	var a = p0.lerp(p1, u / t1)
	var b = p1.lerp(p2, (u - t1) / (t2 - t1))
	var c = p2.lerp(p3, (u - t2) / (t3 - t2))
	return a.lerp(b, u / t2).lerp(b.lerp(c, (u - t1) / (t3 - t1)), (u - t1) / (t2 - t1))


static func validate(raw: Variant) -> Array[String]:
	var errors: Array[String] = []
	if not raw is Dictionary:
		return ["The file must contain a track object."]
	var header_errors_result = _header_errors(raw)
	if not header_errors_result.is_empty():
		return header_errors_result
	if not raw.get("closed", true):
		errors.append("Close the circuit before racing.")
	var grid_errors_result = _grid_errors(raw)
	if not grid_errors_result.is_empty():
		return grid_errors_result
	if not raw.get("name", "") is String or str(raw.get("name", "")).strip_edges().is_empty():
		errors.append("Give the circuit a name.")
	var visual_errors_result = _visual_errors(raw)
	if not visual_errors_result.is_empty():
		return visual_errors_result
	var road_errors_result = _road_errors(raw, errors)
	if not road_errors_result.is_empty():
		return road_errors_result
	for key in ["pits", "features", "objects", "timingGates", "cornerMarkers"]:
		if not raw.get(key, []) is Array or raw.get(key, []).size() > 2000:
			return ["Invalid or excessive %s." % key]
	var pit_errors_result = _pit_errors(raw)
	if not pit_errors_result.is_empty():
		return pit_errors_result
	var feature_errors_result = _feature_errors(raw)
	if not feature_errors_result.is_empty():
		return feature_errors_result
	var scenery_timing_errors_result = _scenery_timing_errors(raw)
	if not scenery_timing_errors_result.is_empty():
		return scenery_timing_errors_result
	var reference_errors_result = _reference_errors(raw)
	if not reference_errors_result.is_empty():
		return reference_errors_result
	return errors


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
	var n = node_at(p, lerpf(a.w, b.w, t), next_node_id(d.nodes))
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


static func next_node_id(nodes: Array) -> String:
	var used: Dictionary = {}
	for node in nodes:
		if node is Dictionary:
			used[str(node.get("id", ""))] = true
	for index in range(nodes.size() + 1):
		var candidate = "n-edit-%d" % index
		if not used.has(candidate):
			return candidate
	return ""  # The pigeonhole bound above always supplies an unused ID.


## Editable drafts may have an unfinished road, but never malformed nested data.


static func draft_errors(value: Dictionary) -> Array[String]:
	var errors: Array[String] = []
	if not serializable(value, 0):
		errors.append("Track drafts require finite, bounded serialized values.")
		return errors
	if not value.get("nodes") is Array or value.nodes.size() > TrackDocument.MAX_NODES:
		errors.append("The track requires a bounded road-point collection.")
		return errors
	for key in ["visual", "grid", "provenance"]:
		if not value.get(key, {}) is Dictionary:
			errors.append("Invalid draft metadata: " + key)
	for key in ["features", "pits", "objects", "timingGates", "cornerMarkers"]:
		if not value.get(key, []) is Array:
			errors.append("Invalid draft collection: " + key)
	_draft_point_errors(value.nodes, errors)
	if not errors.is_empty():
		return errors
	# Reuse the track contract for nested metadata. Replace only the unfinished
	# road in this validation copy: an open/short draft is legal editing state,
	# but malformed pits, scenery, dimensions or references are not.
	var structural = value.duplicate(true)
	structural.nodes = [
		{"x": -100.0, "y": -100.0},
		{"x": 100.0, "y": -100.0},
		{"x": 100.0, "y": 100.0},
		{"x": -100.0, "y": 100.0}
	]
	structural.closed = true
	structural.name = "Draft validation"
	errors.append_array(TrackDocument.validate(structural))
	for node in value.nodes:
		if not TrackDocument.valid_number(node.get("h", 0), -1000, 10000):
			errors.append("Road height must remain within the authoring bounds.")
		if not TrackDocument.valid_number(node.get("w", 14), 5, 40):
			errors.append("Road width must remain between 5 and 40 metres.")
		if not TrackDocument.valid_number(node.get("bank", 0), -45, 45):
			errors.append("Road banking must remain within ±45 degrees.")
	if not value.get("closed", true) is bool or not value.get("name", "") is String:
		errors.append("Track name and closed state have invalid types.")
	if JSON.stringify(value).length() > 12000000:
		errors.append("The authoring document is too large.")
	return errors


static func serializable(value: Variant, depth: int = 0) -> bool:
	# Public authoring compatibility; shape policy is shared, domain rules are not.
	return RaceStateValue.serializable(value, depth)


## Publishing requires the same safe draft plus the complete track contract.


static func publication_errors(value: Dictionary) -> Array[String]:
	var errors = draft_errors(value)
	if errors.is_empty():
		errors = validate(value)
	return errors


static func _draft_point_errors(nodes: Array, errors: Array[String]) -> void:
	for node in nodes:
		if not node is Dictionary:
			errors.append("Every draft road point requires named coordinates.")
			break
		for axis in ["x", "y"]:
			if not TrackDocument.valid_number(node.get(axis), -100000, 100000):
				errors.append(
					"Road coordinates must be finite numbers within the authoring bounds."
				)
		for handle in ["in", "out"]:
			if not node.get(handle, {}) is Dictionary:
				errors.append("Invalid control handle.")
				continue
			for axis in ["x", "y"]:
				if not TrackDocument.valid_number(node.get(handle, {}).get(axis, 0), -10000, 10000):
					errors.append("Invalid control handle coordinate.")


static func _header_errors(raw: Dictionary) -> Array[String]:
	if raw.get("kind", FORMAT) not in [FORMAT, "circuit-atelier-project"]:
		return ["Unsupported file type. Import an authoring track, not a runtime export."]
	var version = raw.get("version", 1)
	if (
		typeof(version) not in [TYPE_FLOAT, TYPE_INT]
		or version < 1
		or version > (4 if raw.get("kind") == "circuit-atelier-project" else VERSION)
	):
		return ["Unsupported track version."]
	if not raw.get("nodes") is Array or raw.nodes.size() < 4 or raw.nodes.size() > MAX_NODES:
		return ["A circuit needs 4–2000 control points."]
	if not raw.get("closed", true) is bool:
		return ["Closed must be a boolean."]
	return []


static func _grid_errors(raw: Dictionary) -> Array[String]:
	for key in ["grid", "provenance"]:
		if not raw.get(key, {}) is Dictionary:
			return ["Invalid %s object." % key]
	if not valid_number(raw.get("grid", {}).get("spacing", 8), 6, 20):
		return ["Grid spacing must be 6–20 metres."]
	if not RaceCheckpoint.integral(raw.get("grid", {}).get("count", 12), 1, MAX_GRID_PLACES):
		return ["Grid places must be an integer from 1 to 64."]
	return []


static func _road_errors(raw: Dictionary, errors: Array[String]) -> Array[String]:
	var distinct: Dictionary = {}
	var polygon: Array = []
	for n in raw.nodes:
		var point_coordinate_errors_result = _point_coordinate_errors(n)
		if not point_coordinate_errors_result.is_empty():
			return point_coordinate_errors_result
		var vals = (
			n
			if n is Array
			else [n.get("x"), n.get("y"), n.get("h", 0), n.get("w", 14), n.get("bank", 0)]
		)
		var p = Vector2(vals[0], vals[1])
		distinct["%.3f,%.3f" % [p.x, p.y]] = true
		polygon.append(p)
		var point_shape_errors_result = _point_shape_errors(n, vals)
		if not point_shape_errors_result.is_empty():
			return point_shape_errors_result
	if distinct.size() < 4:
		errors.append("A circuit needs four distinct points.")
	var perimeter = 0.0
	for i in range(polygon.size()):
		perimeter += polygon[i].distance_to(polygon[(i + 1) % polygon.size()])
	if perimeter < 100:
		errors.append("The control polygon must span at least 100 metres.")
	for key in ["start"]:
		var v = raw.get(key, 0)
		if typeof(v) not in [TYPE_FLOAT, TYPE_INT] or not is_finite(v) or v < 0 or v >= 1:
			errors.append("Start/finish must be a fraction from 0 to less than 1.")
	return []
