class_name RacingLine
extends RefCounted
## Bounded candidate search. Time is evaluated on each candidate's actual 3D arc.
## This is a reproducible game heuristic, not a globally optimal vehicle solver.
const REVISION = "time-candidate-v2"

static func solve(g, car: Dictionary) -> Dictionary:
	var n: int = g.points.size()
	var offsets = PackedFloat64Array(); offsets.resize(n); offsets.fill(0.0)
	var best = evaluate(g, offsets, car)
	var centre_time: float = best.time
	for iteration in range(32):
		var next = offsets.duplicate()
		for i in range(n):
			var before = posmod(i - 3, n); var after = (i + 3) % n
			var midpoint = (g.points[before] + g.normals[before] * offsets[before] + g.points[after] + g.normals[after] * offsets[after]) * 0.5
			var margin = maxf(1.5, float(car.width) * 0.5 + 0.45)
			var room = maxf(0, g.widths[i] * 0.5 - margin)
			next[i] = clampf(lerpf(offsets[i], (midpoint - g.points[i]).dot(g.normals[i]), 0.3), -room, room)
		offsets = next
		if iteration in [7, 15, 31]:
			var candidate = evaluate(g, offsets, car)
			if candidate.time < best.time: best = candidate
	best.centre_time = centre_time
	return best

static func evaluate(g, offsets: PackedFloat64Array, car: Dictionary) -> Dictionary:
	var n: int = g.points.size()
	var path = PackedVector2Array(); path.resize(n)
	var distance = PackedFloat64Array(); distance.resize(n)
	var curve = PackedFloat64Array(); curve.resize(n)
	var speed = PackedFloat64Array(); speed.resize(n)
	for i in range(n): path[i] = g.points[i] + g.normals[i] * offsets[i]
	for i in range(n):
		var j = (i + 1) % n
		distance[i] = maxf(0.05, sqrt(path[i].distance_squared_to(path[j]) + (g.heights[j] - g.heights[i]) ** 2))
		var a = path[posmod(i - 2, n)]; var b = path[i]; var c = path[(i + 2) % n]
		curve[i] = 2.0 * (b - a).cross(c - a) / maxf(0.001, a.distance_to(b) * b.distance_to(c) * c.distance_to(a))
		var lateral = maxf(3.0, car.lat + 9.81 * sin(deg_to_rad(g.banks[i])) * signf(curve[i]))
		speed[i] = minf(car.top, sqrt(lateral / maxf(0.00001, absf(curve[i]))))
	# Propagate both directions around the closed lap; use candidate arc, not centreline spacing.
	for pass_index in range(4):
		for k in range(n):
			var i = n - 1 - k; var j = (i + 1) % n
			var grade = (g.heights[j] - g.heights[i]) / distance[i]
			speed[i] = minf(speed[i], sqrt(speed[j] ** 2 + 2 * maxf(2, car.brake + 9.81 * grade) * distance[i]))
		for i in range(n):
			var j = posmod(i - 1, n)
			var grade = (g.heights[i] - g.heights[j]) / distance[j]
			speed[i] = minf(speed[i], sqrt(speed[j] ** 2 + 2 * maxf(1, car.accel - 9.81 * grade) * distance[j]))
	var time = 0.0
	for i in range(n): time += 2 * distance[i] / maxf(1, speed[i] + speed[(i + 1) % n])
	return {"offsets": offsets.duplicate(), "curvature": curve, "speeds": speed, "distances": distance, "time": time}
