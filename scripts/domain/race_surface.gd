class_name RaceSurface
extends RefCounted
## Source-informed spatial surface: 96 stations x 7 lateral strips.
## Normalized deposits are a gameplay field, not a fluid/chemical simulation.
const STATIONS = 96
const LANES = 7
const CHANNELS = ["water", "rubber", "dust", "marbles", "oil", "debris", "temperature"]
const INTERVAL = 0.25

static func create(track: TrackGeometry, water: Array, rubber: Array) -> Array:
	var grid: Array = []
	for i in range(STATIONS):
		var s = track.sample(i * track.length / STATIONS)
		var col = {"width": s.w, "line": s.line, "camber": tan(deg_to_rad(clampf(s.bank, -20, 20))), "lanes": []}
		for j in range(LANES):
			col.lanes.append({"water": float(water[i]), "rubber": float(rubber[i]), "dust": 0.11 + absf(j - 3) * 0.014, "marbles": 0.012, "oil": 0.0, "debris": 0.0, "temperature": 20.0 if water[i] > 0.1 else 29.0})
		grid.append(col)
	return grid

static func lane_value(column: Dictionary, lane: float) -> float:
	return clampf((lane / column.width + 0.5) * LANES - 0.5, 0, LANES - 1)

static func within(column: Dictionary, lane: float) -> Dictionary:
	var at = lane_value(column, lane); var j = int(at); var t = at - j
	var a = column.lanes[j]; var b = column.lanes[mini(j + 1, LANES - 1)]; var result = {}
	for key in CHANNELS: result[key] = lerpf(a[key], b[key], t)
	return result

static func sample(grid: Array, fraction: float, lane: float) -> Dictionary:
	var at = fposmod(fraction, 1.0) * STATIONS; var i = int(at); var t = at - i
	var a = within(grid[i], lane); var b = within(grid[(i + 1) % STATIONS], lane)
	for key in CHANNELS: a[key] = lerpf(a[key], b[key], t)
	a.grip = grip(a)
	return a

static func grip(s: Dictionary) -> float:
	var rubber_gain = s.rubber * 0.17 * (1 - s.water) ** 2
	var wet_rubber = s.rubber * maxf(0, s.water - 0.2) * 0.1
	var contamination = s.dust * 0.13 + s.marbles * 0.17 + s.debris * 0.14 + s.oil * 0.43
	return clampf(0.96 + rubber_gain - wet_rubber - s.water * 0.30 - s.water ** 2 * 0.13 - contamination, 0.3, 1.14)

static func runoff(column: Dictionary, dt: float) -> void:
	# Pairwise exchange removes exactly what it adds; sources/sinks are separate.
	var delta: Array = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
	for j in range(LANES - 1):
		var a: float = column.lanes[j].water; var b: float = column.lanes[j + 1].water
		var transfer = ((a - b) * 0.020 + column.camber * 0.2 * (a + b) * 0.08) * dt
		transfer = clampf(transfer, -minf(b, 1 - a) * 0.45, minf(a, 1 - b) * 0.45)
		delta[j] -= transfer; delta[j + 1] += transfer
	for j in range(LANES): column.lanes[j].water = clampf(column.lanes[j].water + delta[j], 0, 1)

static func evolve(grid: Array, rain: float, dt: float, time: float) -> void:
	for i in range(STATIONS):
		var col = grid[i]; runoff(col, dt)
		var local_rain = rain * clampf(0.85 + 0.30 * sin(i * 0.077 + time * 0.002), 0.5, 1.2)
		for j in range(LANES):
			var s = col.lanes[j]
			var drainage = maxf(0.15, 1 + col.camber * (j - 3) / 3.0 * 2)
			var evaporation = 0.00046 + (s.temperature - 15) * 0.000018
			s.water = clampf(s.water + (local_rain * 0.008 * (1 - s.water) - 0.0015 * drainage * (0.22 + sqrt(s.water)) - evaporation * (1.0 if local_rain < 0.1 else 0.18)) * dt, 0, 1)
			s.rubber = maxf(0, s.rubber - s.rubber * (local_rain * 0.00155 + s.water * 0.00005) * dt)
			s.dust = maxf(0, s.dust - local_rain * 0.00027 * dt)
			s.marbles = maxf(0, s.marbles - local_rain * 0.00015 * dt)
			s.oil = maxf(0, s.oil - dt * (local_rain * 0.00014 + 0.00015))
			s.debris = maxf(0, s.debris - dt * 0.00022)
			s.temperature = lerpf(s.temperature, 19.0 if local_rain > 0.1 else 32.0, minf(1, dt * 0.006))

static func deposit(grid: Array, length_m: float, c: Dictionary, from: float, to: float, curve: float) -> Array[int]:
	var touched: Array[int] = []
	var distance = maxf(0, to - from)
	if distance == 0: return touched
	var count = maxi(1, ceili(distance / 12.0)); var weight = distance / count / (length_m / STATIONS)
	for k in range(count):
		var fraction = fposmod(lerpf(from, to, (k + 0.5) / count) / length_m, 1.0)
		var i = int(fraction * STATIONS); var col = grid[i]; var at = lane_value(col, c.lane)
		if i not in touched: touched.append(i)
		for j in range(LANES):
			var contact = exp(-0.5 * ((j - at) / 0.65) ** 2)
			if contact < 0.004: continue
			var s = col.lanes[j]
			s.rubber = minf(1, s.rubber + weight * contact * 0.009 * (1 - s.water) ** 2)
			s.water = maxf(0, s.water - weight * contact * (0.021 if c.compound in ["I", "W"] else 0.013))
			s.dust = maxf(0, s.dust - weight * contact * 0.021)
			s.marbles = maxf(0, s.marbles - weight * contact * 0.005)
			s.temperature = minf(80, s.temperature + weight * contact * (0.022 + c.braking * 0.06))
		var outside = clampi(floori(at) - 2 if curve > 0 else ceili(at) + 2, 0, LANES - 1)
		col.lanes[outside].marbles = minf(1, col.lanes[outside].marbles + weight * 0.004 * (1.4 if c.pace == 2 else 1.0))
	return touched

static func contaminate(grid: Array, fraction: float, lane: float, severity: float, oil: bool) -> void:
	for offset in [-1, 0, 1]:
		var col = grid[posmod(int(fposmod(fraction, 1.0) * STATIONS) + offset, STATIONS)]
		var s = col.lanes[roundi(lane_value(col, lane))]
		s.debris = minf(1, s.debris + severity * (1.0 if offset == 0 else 0.35))
		if oil: s.oil = minf(1, s.oil + 0.42)

static func profiles(grid: Array, water: Array, rubber: Array, indices: Array = []) -> void:
	var selected: Array = range(STATIONS) if indices.is_empty() else indices
	for i in selected:
		var value = within(grid[i], grid[i].line)
		water[i] = value.water; rubber[i] = value.rubber

static func valid(grid: Variant, water: Array, rubber: Array) -> bool:
	if not grid is Array or grid.size() != STATIONS: return false
	for i in range(STATIONS):
		var col = grid[i]
		if not col is Dictionary or not col.get("lanes") is Array or col.lanes.size() != LANES: return false
		if not TrackDocument.valid_number(col.get("width"), 1, 100) or not TrackDocument.valid_number(col.get("camber"), -1, 1) or not TrackDocument.valid_number(col.get("line"), -50, 50): return false
		for s in col.lanes:
			if not s is Dictionary: return false
			for key in CHANNELS:
				if not TrackDocument.valid_number(s.get(key), 0, 100 if key == "temperature" else 1): return false
		var value = within(col, col.line)
		if not TrackDocument.valid_number(water[i], 0, 1) or not TrackDocument.valid_number(rubber[i], 0, 1): return false
		if absf(value.water - water[i]) > 0.00001 or absf(value.rubber - rubber[i]) > 0.00001: return false
	return true
