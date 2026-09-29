class_name RaceSurface
extends RefCounted
## Source-informed spatial surface: 96 stations x 7 lateral strips.
## Normalized deposits are a gameplay field, not a fluid/chemical simulation.
const STATIONS = 96
const LANES = 7
const CHANNELS = ["water", "rubber", "dust", "marbles", "oil", "debris", "temperature"]
const INTERVAL = 0.25

static func create(track: TrackGeometry, water: Array, rubber: Array, p: Dictionary = SurfaceTuning.DEFAULTS) -> Array:
	var grid: Array = []
	for i in range(STATIONS):
		var s = track.sample(i * track.length / STATIONS)
		var col = {"width": s.w, "line": s.line, "camber": tan(deg_to_rad(clampf(s.bank, -20, 20))), "lanes": []}
		for j in range(LANES):
			col.lanes.append({"water": float(water[i]), "rubber": float(rubber[i]), "dust": p.initial_dust + absf(j - 3) * p.edge_dust_per_lane, "marbles": p.initial_marbles, "oil": 0.0, "debris": 0.0, "temperature": p.initial_wet_c if water[i] > p.initial_wet_threshold else p.initial_dry_c})
		grid.append(col)
	return grid

static func lane_value(column: Dictionary, lane: float) -> float:
	return clampf((lane / column.width + 0.5) * LANES - 0.5, 0, LANES - 1)

static func within(column: Dictionary, lane: float) -> Dictionary:
	var at = lane_value(column, lane); var j = int(at); var t = at - j
	var a = column.lanes[j]; var b = column.lanes[mini(j + 1, LANES - 1)]; var result = {}
	for key in CHANNELS: result[key] = lerpf(a[key], b[key], t)
	return result

static func sample(grid: Array, fraction: float, lane: float, p: Dictionary = SurfaceTuning.DEFAULTS) -> Dictionary:
	var at = fposmod(fraction, 1.0) * STATIONS; var i = int(at); var t = at - i
	var a = within(grid[i], lane); var b = within(grid[(i + 1) % STATIONS], lane)
	for key in CHANNELS: a[key] = lerpf(a[key], b[key], t)
	a.grip = grip(a, p)
	return a

static func grip(s: Dictionary, p: Dictionary = SurfaceTuning.DEFAULTS) -> float:
	var rubber_gain = s.rubber * p.rubber_grip_gain * (1 - s.water) ** 2
	var wet_rubber = s.rubber * maxf(0, s.water - p.wet_rubber_threshold) * p.wet_rubber_grip_loss
	var contamination = s.dust * p.dust_grip_loss + s.marbles * p.marbles_grip_loss + s.debris * p.debris_grip_loss + s.oil * p.oil_grip_loss
	return clampf(p.base_grip + rubber_gain - wet_rubber - s.water * p.water_grip_loss - s.water ** 2 * p.water_squared_grip_loss - contamination, p.minimum_grip, p.maximum_grip)

static func runoff(column: Dictionary, dt: float, p: Dictionary = SurfaceTuning.DEFAULTS) -> void:
	# Pairwise exchange removes exactly what it adds; sources/sinks are separate.
	var delta: Array = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
	for j in range(LANES - 1):
		var a: float = column.lanes[j].water; var b: float = column.lanes[j + 1].water
		var transfer = ((a - b) * p.lateral_exchange_rate + column.camber * p.camber_flow_gain * (a + b) * p.water_flow_gain) * dt
		transfer = clampf(transfer, -minf(b, 1 - a) * 0.45, minf(a, 1 - b) * 0.45)
		delta[j] -= transfer; delta[j + 1] += transfer
	for j in range(LANES): column.lanes[j].water = clampf(column.lanes[j].water + delta[j], 0, 1)

static func evolve(grid: Array, rain: float, dt: float, time: float, p: Dictionary = SurfaceTuning.DEFAULTS) -> void:
	for i in range(STATIONS):
		var col = grid[i]; runoff(col, dt, p)
		var local_rain = rain * clampf(p.local_rain_base + p.local_rain_amplitude * sin(i * p.rain_station_phase + time * p.rain_time_phase), p.minimum_local_rain, p.maximum_local_rain)
		for j in range(LANES):
			var s = col.lanes[j]
			var drainage = maxf(p.minimum_drainage, 1 + col.camber * (j - 3) / 3.0 * p.camber_drainage_gain)
			var evaporation = p.evaporation_base + (s.temperature - p.evaporation_reference_c) * p.evaporation_heat_gain
			s.water = clampf(s.water + (local_rain * p.rain_collection_rate * (1 - s.water) - p.drainage_rate * drainage * (p.drainage_base + sqrt(s.water)) - evaporation * (1.0 if local_rain < p.rain_wet_threshold else p.wet_evaporation_multiplier)) * dt, 0, 1)
			s.rubber = maxf(0, s.rubber - s.rubber * (local_rain * p.rubber_rain_wash + s.water * p.rubber_water_wash) * dt)
			s.dust = maxf(0, s.dust - local_rain * p.dust_rain_wash * dt)
			s.marbles = maxf(0, s.marbles - local_rain * p.marbles_rain_wash * dt)
			s.oil = maxf(0, s.oil - dt * (local_rain * p.oil_rain_wash + p.oil_decay))
			s.debris = maxf(0, s.debris - dt * p.debris_decay)
			s.temperature = lerpf(s.temperature, p.wet_target_c if local_rain > p.rain_wet_threshold else p.dry_target_c, minf(1, dt * p.temperature_response_per_second))

static func deposit(grid: Array, length_m: float, c: RaceCar, from: float, to: float, curve: float, p: Dictionary = SurfaceTuning.DEFAULTS) -> Array[int]:
	var touched: Array[int] = []
	var distance = maxf(0, to - from)
	if distance == 0: return touched
	var count = maxi(1, ceili(distance / 12.0)); var weight = distance / count / (length_m / STATIONS)
	for k in range(count):
		var fraction = fposmod(lerpf(from, to, (k + 0.5) / count) / length_m, 1.0)
		var i = int(fraction * STATIONS); var col = grid[i]; var at = lane_value(col, c.lane)
		if i not in touched: touched.append(i)
		for j in range(LANES):
			var contact = exp(-0.5 * ((j - at) / p.contact_width_lanes) ** 2)
			if contact < p.minimum_contact_weight: continue
			var s = col.lanes[j]
			s.rubber = minf(1, s.rubber + weight * contact * p.rubber_deposit * (1 - s.water) ** 2)
			s.water = maxf(0, s.water - weight * contact * (p.wet_tyre_displacement if c.tyre_rules.wet(c.compound) else p.dry_tyre_displacement))
			s.dust = maxf(0, s.dust - weight * contact * p.dust_sweep)
			s.marbles = maxf(0, s.marbles - weight * contact * p.marbles_sweep)
			s.temperature = minf(p.maximum_temperature_c, s.temperature + weight * contact * (p.contact_heating_c + c.braking * p.braking_heating_c))
		var outside = clampi(floori(at) - 2 if curve > 0 else ceili(at) + 2, 0, LANES - 1)
		col.lanes[outside].marbles = minf(1, col.lanes[outside].marbles + weight * p.marbles_deposit * (p.push_marbles_multiplier if c.pace == 2 else 1.0))
	return touched

static func contaminate(grid: Array, fraction: float, lane: float, severity: float, oil: bool, p: Dictionary = SurfaceTuning.DEFAULTS) -> void:
	for offset in [-1, 0, 1]:
		var col = grid[posmod(int(fposmod(fraction, 1.0) * STATIONS) + offset, STATIONS)]
		var s = col.lanes[roundi(lane_value(col, lane))]
		s.debris = minf(1, s.debris + severity * (1.0 if offset == 0 else p.debris_spread_multiplier))
		if oil: s.oil = minf(1, s.oil + p.incident_oil_deposit)

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
