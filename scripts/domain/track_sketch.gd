class_name TrackSketch
extends RefCounted
## Separate trace draft. No road geometry changes until preview is explicitly applied.
var strokes: Array[PackedVector2Array] = []
var future: Array[PackedVector2Array] = []
var closed = false
var redo_closed = false
var tolerance = 2.0
var width = 14.0
var smoothing = 0.2

func points() -> PackedVector2Array:
	var result = PackedVector2Array()
	for stroke in strokes:
		for p in stroke:
			if result.is_empty() or result[-1].distance_to(p) > 0.01: result.append(p)
	return result

func add_stroke(stroke: PackedVector2Array, join_radius: float = 20.0) -> bool:
	if closed or stroke.size() < 2 or points().size() + stroke.size() > 12000: return false
	for p in stroke:
		if not p.is_finite() or absf(p.x) > 100000 or absf(p.y) > 100000: return false
	var prior = points()
	if not prior.is_empty():
		if stroke[0].distance_to(prior[-1]) > join_radius: return false
		stroke[0] = prior[-1]
	strokes.append(stroke.duplicate()); future.clear(); redo_closed = false
	return true

func undo() -> void:
	if closed: closed = false; redo_closed = true; return
	if not strokes.is_empty(): future.append(strokes.pop_back())

func redo() -> void:
	if not closed and not future.is_empty(): strokes.append(future.pop_back()); return
	if redo_closed and not closed: closed = true; redo_closed = false

func clear() -> void:
	strokes.clear(); future.clear(); closed = false; redo_closed = false

func close_loop() -> bool:
	if points().size() < 4: return false
	closed = true; redo_closed = false; return true

func compile(source: Dictionary) -> Dictionary:
	if not closed: return TrackEdit.failure("Close the trace before creating a road preview.")
	var raw = points()
	if raw.size() < 4: return TrackEdit.failure("The trace needs at least four points.")
	if raw[-1].distance_to(raw[0]) > 0.01: raw.append(raw[0])
	var chosen = simplify(raw, tolerance)
	var adjusted = tolerance
	while chosen.size() > 257 and adjusted < 10000:
		adjusted *= 1.5; chosen = simplify(raw, adjusted)
	if chosen.size() > 1 and chosen[0].distance_to(chosen[-1]) < 0.01: chosen.remove_at(chosen.size() - 1)
	if chosen.size() < 4: return TrackEdit.failure("Too few corners remain. Lower simplification or draw a wider loop.")
	var d = source.duplicate(true); d.nodes = []
	for i in range(chosen.size()):
		var n = TrackDocument.node_at(chosen[i], width); n.id = "trace-%d" % i; d.nodes.append(n)
	for i in range(d.nodes.size()):
		TrackDocument.smooth_node(d, i)
		var n = d.nodes[i]; n.mode = "free"
		for key in ["in", "out"]:
			var h = TrackDocument.handle(n, key) * smoothing
			TrackDocument.set_handle(n, key, h)
	d.start = 0.0; d.closed = true; d.reference_length = 0.0
	for key in ["pits", "features", "timingGates", "cornerMarkers"]: d[key] = []
	d.provenance = {"notice": "Player-authored trace. Previous geometry-dependent annotations were cleared on replacement."}
	var errors = TrackDocument.validate(d)
	if not errors.is_empty(): return TrackEdit.failure("\n".join(errors))
	return {"ok": true, "document": d, "nodes": d.nodes.size(), "tolerance": adjusted}

static func simplify(raw: PackedVector2Array, tolerance_m: float) -> PackedVector2Array:
	if raw.size() < 3: return raw.duplicate()
	var stack: Array[Vector2i] = [Vector2i(0, raw.size() - 1)]
	var keep = {0: true, raw.size() - 1: true}
	while not stack.is_empty():
		var pair = stack.pop_back(); var greatest = tolerance_m; var found = -1
		for i in range(pair.x + 1, pair.y):
			var closest = Geometry2D.get_closest_point_to_segment(raw[i], raw[pair.x], raw[pair.y])
			var distance = raw[i].distance_to(closest)
			if distance > greatest: greatest = distance; found = i
		if found >= 0:
			keep[found] = true; stack.append(Vector2i(pair.x, found)); stack.append(Vector2i(found, pair.y))
	var keys = keep.keys(); keys.sort(); var result = PackedVector2Array()
	for key in keys: result.append(raw[key])
	return result
