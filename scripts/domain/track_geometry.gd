class_name TrackGeometry
extends RefCounted
## Immutable compiled snapshot shared by display and simulation; no scene dependencies.
const PRESETS = {
	"Formula": {"top": 89.0, "lat": 24.0, "accel": 9.0, "brake": 17.0, "width": 2.0},
	"GT": {"top": 76.0, "lat": 15.0, "accel": 6.0, "brake": 12.0, "width": 2.1},
	"Touring": {"top": 66.0, "lat": 12.0, "accel": 5.2, "brake": 10.0, "width": 1.9},
	"Kart": {"top": 38.0, "lat": 11.0, "accel": 5.0, "brake": 8.0, "width": 1.4}}
var preview_only = false
var compile_usec = 0
var centre_estimate = 0.0
var line_distances = PackedFloat64Array()
var document: Dictionary
var points = PackedVector2Array()
var normals = PackedVector2Array()
var heights = PackedFloat64Array()
var widths = PackedFloat64Array()
var banks = PackedFloat64Array()
var curvature = PackedFloat64Array()
var offsets = PackedFloat64Array()
var speeds = PackedFloat64Array()
var source_segments: Array = []
var source_t: Array = []
var length = 0.0
var spacing = 4.0
var start = 0.0
var bounds = Rect2()
var pit_points = PackedVector2Array()
var pit_stations = PackedFloat64Array()
var pit_length = 0.0
var pit_entry = 0.0
var pit_exit = 0.0
var pit_limit = 22.2222
var preset = "Formula"
var estimate = 0.0
var sector_ends: Array = []
var grid_spacing = 8.0
var warnings: Array[String] = []

func _init(d: Dictionary = {}, vehicle: String = "Formula", preview: bool = false) -> void:
	if not d.is_empty(): compile(d, vehicle, preview)

func compile(d: Dictionary, vehicle: String = "Formula", preview: bool = false) -> void:
	var started = Time.get_ticks_usec()
	preview_only = preview
	document = TrackDocument.normalize(d)
	preset = vehicle if PRESETS.has(vehicle) else "Formula"
	start = document.start
	grid_spacing = clampf(float(document.grid.get("spacing", 8)), 6, 20)
	var raw: Array = []
	var stations: Array = []
	var cumulative = 0.0
	var previous = Vector2.ZERO
	for i in range(document.nodes.size()):
		var a = document.nodes[i]
		var b = document.nodes[(i + 1) % document.nodes.size()]
		var p0 = TrackDocument.point(a)
		var p1 = p0 + TrackDocument.handle(a, "out")
		var p3 = TrackDocument.point(b)
		var p2 = p3 + TrackDocument.handle(b, "in")
		var count = clampi(int(ceil((p0.distance_to(p1) + p1.distance_to(p2) + p2.distance_to(p3)) / (12.0 if preview else 3.0))), 6, 400)
		for j in range(count):
			var t = float(j) / count
			var p = p0.bezier_interpolate(p1, p2, p3, t)
			if not raw.is_empty(): cumulative += previous.distance_to(p)
			raw.append([p, lerpf(a.h, b.h, t), lerpf(a.w, b.w, t), lerpf(a.bank, b.bank, t), i, t])
			stations.append(cumulative)
			previous = p
	if raw.size() < 4: return
	cumulative += previous.distance_to(raw[0][0])
	length = maxf(1.0, cumulative)
	raw.append(raw[0]); stations.append(length)
	var n = clampi(int(ceil(length / (12.0 if preview else 4.0))), 64, 4096)
	spacing = length / n
	points.clear(); heights.clear(); widths.clear(); banks.clear(); source_segments.clear(); source_t.clear()
	var cursor = 0
	for i in range(n):
		var s = i * spacing
		while cursor + 1 < stations.size() - 1 and stations[cursor + 1] < s: cursor += 1
		var t = (s - stations[cursor]) / maxf(0.001, stations[cursor + 1] - stations[cursor])
		var a = raw[cursor]; var b = raw[cursor + 1]
		points.append(a[0].lerp(b[0], t)); heights.append(lerpf(a[1], b[1], t))
		widths.append(lerpf(a[2], b[2], t)); banks.append(lerpf(a[3], b[3], t))
		source_segments.append(a[4]); source_t.append(lerpf(a[5], b[5] if b[4] == a[4] else 1.0, t))
	bounds = Rect2(points[0], Vector2.ONE)
	normals.resize(n); curvature.resize(n); offsets.resize(n); offsets.fill(0.0)
	for i in range(n):
		bounds = bounds.expand(points[i])
		var tangent = (points[(i + 1) % n] - points[posmod(i - 1, n)]).normalized()
		normals[i] = Vector2(-tangent.y, tangent.x)
	if preview:
		speeds.resize(n); speeds.fill(PRESETS[preset].top)
		curvature.fill(0.0); line_distances.resize(n); line_distances.fill(spacing)
		estimate = 0.0
	else:
		var result = RacingLine.solve(self, PRESETS[preset])
		offsets = result.offsets; speeds = result.speeds; curvature = result.curvature
		line_distances = result.distances; estimate = result.time; centre_estimate = result.centre_time
	warnings.clear()
	if length < 400: warnings.append("Very short track: pit lane and a 12-car grid may not fit.")
	if length > 15000: warnings.append("Long layout: increase qualifying time to complete a full run.")
	var steep = false
	for i in range(n):
		if absf(heights[(i + 1) % n] - heights[i]) / spacing > 0.25: steep = true
	if steep: warnings.append("Grade exceeds 25%; review the elevation profile.")
	sector_ends.clear()
	for gate in document.timingGates:
		if gate.get("type", "sector") == "sector" and gate.has("f"):
			var station = fposmod(float(gate.f) - start, 1.0) * length
			if station > 1 and station < length - 1: sector_ends.append(station)
	sector_ends.sort()
	if sector_ends.size() != 2 or sector_ends[1] - sector_ends[0] < 1.0: sector_ends = [length / 3.0, length * 2.0 / 3.0]
	sector_ends.append(length)
	_compile_pit()
	compile_usec = Time.get_ticks_usec() - started

func line_point(i: int) -> Vector2:
	return points[i] + normals[i] * offsets[i]

func sample(distance: float, absolute: bool = false) -> Dictionary:
	var index = fposmod(distance + (0.0 if absolute else start * length), length) / spacing
	var i = int(index) % points.size(); var j = (i + 1) % points.size(); var t = index - floor(index)
	return {"p": points[i].lerp(points[j], t), "n": normals[i].lerp(normals[j], t).normalized(), "h": lerpf(heights[i], heights[j], t), "w": lerpf(widths[i], widths[j], t), "bank": lerpf(banks[i], banks[j], t), "line": lerpf(offsets[i], offsets[j], t), "speed": lerpf(speeds[i], speeds[j], t), "curvature": lerpf(curvature[i], curvature[j], t), "path_scale": maxf(0.1, lerpf(line_distances[i], line_distances[j], t) / spacing), "i": i}

func nearest(p: Vector2) -> Dictionary:
	# Project onto each sampled segment. Picking no longer quantizes to a 4 m sample.
	var best = INF; var index = 0; var local_t = 0.0
	for i in range(points.size()):
		var delta = points[(i + 1) % points.size()] - points[i]
		var t = clampf((p - points[i]).dot(delta) / maxf(0.000001, delta.length_squared()), 0, 1)
		var distance = (points[i] + delta * t).distance_squared_to(p)
		if distance < best: best = distance; index = i; local_t = t
	var j = (index + 1) % points.size()
	var source_time = lerpf(source_t[index], source_t[j] if source_segments[j] == source_segments[index] else 1.0, local_t)
	return {"index": index, "fraction": fposmod((index + local_t) / points.size(), 1.0), "segment": source_segments[index], "t": source_time, "distance": sqrt(best)}

func sector_at(distance: float) -> int:
	var station = fposmod(distance, length)
	for i in range(2):
		if station < sector_ends[i]: return i
	return 2

func _compile_pit() -> void:
	pit_points.clear(); pit_stations.clear(); pit_length = 0.0
	if document.pits.is_empty():
		warnings.append("No authored pit lane; a generated service lane is used. Generate and edit a pit lane before finalizing.")
		var p = {"entry": fposmod(start + 0.87, 1), "exit": fposmod(start + 0.09, 1), "width": 5.0, "speed": 60, "nodes": []}
		for i in range(1, 10):
			var a = sample((0.87 + 0.22 * i / 10.0) * length)
			var pos = a.p + a.n * (a.w * 0.5 + 13.0)
			var node = TrackDocument.node_at(pos, 5); node.id = "generated-pit-%d" % i
			p.nodes.append(node)
		document.pits = [p]
	var pit = document.pits[0]
	pit_entry = fposmod(float(pit.entry) - start, 1.0) * length
	pit_exit = pit_entry + fposmod(float(pit.exit) - float(pit.entry), 1.0) * length
	pit_limit = clampf(float(pit.get("speed", 80)), 30, 100) / 3.6
	pit_points.append(sample(pit_entry).p)
	for node in pit.nodes: pit_points.append(TrackDocument.point(node))
	pit_points.append(sample(pit_exit).p)
	pit_stations.append(0.0)
	for i in range(1, pit_points.size()):
		pit_length += pit_points[i - 1].distance_to(pit_points[i]); pit_stations.append(pit_length)
	pit_length = maxf(1.0, pit_length)

func pit_sample(distance: float) -> Dictionary:
	var d = clampf(distance, 0, pit_length)
	var i = 0
	while i < pit_stations.size() - 2 and pit_stations[i + 1] < d: i += 1
	var t = (d - pit_stations[i]) / maxf(0.001, pit_stations[i + 1] - pit_stations[i])
	var tangent = (pit_points[i + 1] - pit_points[i]).normalized()
	return {"p": pit_points[i].lerp(pit_points[i + 1], t), "n": Vector2(-tangent.y, tangent.x)}

func runtime_export() -> Dictionary:
	var samples: Array = []
	for i in range(points.size()):
		samples.append({"s": i * spacing, "x": points[i].x, "y": points[i].y, "height": heights[i], "width": widths[i], "bank_deg": banks[i], "line_offset": offsets[i], "curvature": curvature[i], "speed_mps": speeds[i], "line_arc_to_next_m": line_distances[i]})
	return {"kind": "motorsport-manager-runtime", "version": 2, "units": "metres-seconds-radians-except-bank_deg", "axis": "+X east, +Y north, +height up", "name": document.name, "length": length, "start_fraction": start, "vehicle": preset, "solver": RacingLine.REVISION, "estimate_seconds": estimate, "centreline_estimate_seconds": centre_estimate, "samples": samples, "pits": document.pits, "features": document.features, "objects": document.objects, "timing_gates": document.timingGates, "grid": document.grid, "sector_ends_m": sector_ends, "provenance": document.provenance, "visual": document.get("visual", {}).duplicate(true), "illustration_revision": "cozy-circuit-v1"}
