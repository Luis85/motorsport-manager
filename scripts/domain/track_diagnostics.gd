class_name TrackDiagnostics
extends RefCounted
## Authoring checks are separate from schema validation and from the race simulation.
## These checks find sampled centreline problems; they are not safety certification.

static func inspect(g) -> Array:
	var issues: Array = []
	if g == null or g.points.is_empty(): return issues
	for warning in g.warnings:
		issues.append(issue("warning", "geometry", warning, 0.0))
	var n: int = g.points.size()
	var cell_size = maxf(24, g.spacing * 2)
	var buckets: Dictionary = {}; var visited: Dictionary = {}
	for i in range(n):
		var a: Vector2 = g.points[i]; var b: Vector2 = g.points[(i + 1) % n]
		var lo = Vector2i(floori(minf(a.x, b.x) / cell_size), floori(minf(a.y, b.y) / cell_size))
		var hi = Vector2i(floori(maxf(a.x, b.x) / cell_size), floori(maxf(a.y, b.y) / cell_size))
		for x in range(lo.x, hi.x + 1):
			for y in range(lo.y, hi.y + 1):
				var key = Vector2i(x, y)
				for j in buckets.get(key, []):
					if mini(absi(i - j), n - absi(i - j)) <= 2: continue
					var pair: int = i * n + j
					if visited.has(pair): continue
					visited[pair] = true
					var c: Vector2 = g.points[j]; var d: Vector2 = g.points[(j + 1) % n]
					var hit = Geometry2D.segment_intersects_segment(a, b, c, d)
					if hit == null: continue
					var ta = a.distance_to(hit) / maxf(0.0001, a.distance_to(b))
					var tb = c.distance_to(hit) / maxf(0.0001, c.distance_to(d))
					var height_a = lerpf(g.heights[i], g.heights[(i + 1) % n], ta)
					var height_b = lerpf(g.heights[j], g.heights[(j + 1) % n], tb)
					var clearance = absf(height_a - height_b)
					var severity = "error" if clearance < 4.5 else "info"
					var text = "Road crosses itself with only %.1f m vertical separation. Separate the routes or adjust elevations." % clearance if severity == "error" else "Grade-separated crossing: %.1f m road-to-road separation. Review bridge thickness and headroom." % clearance
					var finding = issue(severity, "crossing", text, float(i + ta) / n)
					finding.other_fraction = float(j + tb) / n; finding.clearance_m = clearance
					issues.append(finding)
				if not buckets.has(key): buckets[key] = []
				buckets[key].append(i)
		if issues.size() >= 40: break
	if g.pit_length < 70:
		issues.append(issue("warning", "pit", "Short service lane: review room for six shared team boxes and their queues.", g.document.pits[0].entry))
	for index in [0, 1]:
		var f: float = g.document.pits[0].entry if index == 0 else g.document.pits[0].exit
		var road = g.sample(f * g.length, true)
		var tangent: Vector2 = Vector2(road.n.y, -road.n.x)
		var pit_direction: Vector2 = g.pit_points[1] - g.pit_points[0] if index == 0 else g.pit_points[-1] - g.pit_points[-2]
		if absf(tangent.angle_to(pit_direction)) > deg_to_rad(65):
			issues.append(issue("warning", "pit", "Pit %s turns more than 65° from the road. Align the first/last pit point with traffic." % ("entry" if index == 0 else "exit"), f))
	for i in range(n):
		if absf(g.curvature[i]) > 0.25:
			issues.append(issue("warning", "corner", "Very tight racing-line radius below 4 m. Inspect the handles, width and chosen vehicle.", float(i) / n))
			break
	if g.document.timingGates.size() > 0:
		var gates: Array = []
		for gate in g.document.timingGates:
			if gate.get("type", "sector") == "sector": gates.append(gate.get("f", 0))
		if gates.size() != 2 or absf(fposmod(float(gates[0]) - float(gates[-1]), 1.0)) < 0.002:
			issues.append(issue("warning", "timing", "Provide two distinct sector boundaries. Invalid layouts use equal thirds.", g.start))
	return issues

static func issue(severity: String, code: String, message: String, fraction: float) -> Dictionary:
	return {"severity": severity, "code": code, "message": message, "fraction": fposmod(fraction, 1.0)}

static func blocking(issues: Array) -> bool:
	for entry in issues:
		if entry.severity == "error": return true
	return false
