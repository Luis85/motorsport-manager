class_name RaceSurface
extends RefCounted
## Source-informed spatial surface: 96 stations x 7 lateral strips.
## Normalized deposits are a gameplay field, not a fluid/chemical simulation.
const STATIONS = 96
const LANES = 7
const CHANNELS = ["water", "rubber", "dust", "marbles", "oil", "debris", "temperature"]
const INTERVAL = 0.25


static func create(
	track: TrackGeometry,
	water: Array,
	rubber: Array,
	rules: Dictionary = LegacyEnvironment.VALUES.surface
) -> Array:
	var initial: Dictionary = rules.initial
	var grid: Array = []
	for i in range(STATIONS):
		var s = track.sample(i * track.length / STATIONS)
		var col = {
			"width": s.w,
			"line": s.line,
			"camber": tan(deg_to_rad(clampf(s.bank, -20, 20))),
			"lanes": []
		}
		for j in range(LANES):
			col.lanes.append(
				{
					"water": float(water[i]),
					"rubber": float(rubber[i]),
					"dust": initial.dust_base + absf(j - 3) * initial.dust_per_strip,
					"marbles": initial.marbles,
					"oil": 0.0,
					"debris": 0.0,
					"temperature":
					(
						initial.wet_temperature_c
						if water[i] > initial.wet_threshold
						else initial.dry_temperature_c
					)
				}
			)
		grid.append(col)
	return grid


static func lane_value(column: Dictionary, lane: float) -> float:
	return clampf((lane / column.width + 0.5) * LANES - 0.5, 0, LANES - 1)


static func within(column: Dictionary, lane: float) -> Dictionary:
	var at = lane_value(column, lane)
	var j = int(at)
	var t = at - j
	var a = column.lanes[j]
	var b = column.lanes[mini(j + 1, LANES - 1)]
	var result = {}
	for key in CHANNELS:
		result[key] = lerpf(a[key], b[key], t)
	return result


static func sample(
	grid: Array, fraction: float, lane: float, rules: Dictionary = LegacyEnvironment.VALUES.surface
) -> Dictionary:
	var at = fposmod(fraction, 1.0) * STATIONS
	var i = int(at)
	var t = at - i
	var a = within(grid[i], lane)
	var b = within(grid[(i + 1) % STATIONS], lane)
	for key in CHANNELS:
		a[key] = lerpf(a[key], b[key], t)
	a.grip = grip(a, rules.grip)
	return a


static func grip(s: Dictionary, rules: Dictionary = LegacyEnvironment.VALUES.surface.grip) -> float:
	var rubber_gain = s.rubber * rules.rubber_gain * (1 - s.water) ** 2
	var wet_rubber = (
		s.rubber * maxf(0, s.water - rules.wet_rubber_threshold) * rules.wet_rubber_loss
	)
	var contamination = (
		s.dust * rules.dust_loss
		+ s.marbles * rules.marbles_loss
		+ s.debris * rules.debris_loss
		+ s.oil * rules.oil_loss
	)
	return clampf(
		(
			rules.base
			+ rubber_gain
			- wet_rubber
			- s.water * rules.water_linear_loss
			- s.water ** 2 * rules.water_squared_loss
			- contamination
		),
		rules.minimum,
		rules.maximum
	)


static func runoff(
	column: Dictionary, dt: float, rules: Dictionary = LegacyEnvironment.VALUES.surface.runoff
) -> void:
	# Pairwise exchange removes exactly what it adds; sources/sinks are separate.
	var delta: Array = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
	for j in range(LANES - 1):
		var a: float = column.lanes[j].water
		var b: float = column.lanes[j + 1].water
		var transfer = (
			(
				(a - b) * rules.diffusion_per_second
				+ column.camber * rules.camber_factor * (a + b) * rules.advection_per_second
			)
			* dt
		)
		transfer = clampf(transfer, -minf(b, 1 - a) * 0.45, minf(a, 1 - b) * 0.45)
		delta[j] -= transfer
		delta[j + 1] += transfer
	for j in range(LANES):
		column.lanes[j].water = clampf(column.lanes[j].water + delta[j], 0, 1)


static func evolve(
	grid: Array,
	rain: float,
	dt: float,
	time: float,
	rules: Dictionary = LegacyEnvironment.VALUES.surface
) -> void:
	var evolution: Dictionary = rules.evolution
	for i in range(STATIONS):
		var col = grid[i]
		runoff(col, dt, rules.runoff)
		var local_rain = (
			rain
			* clampf(
				(
					evolution.rain_base
					+ (
						evolution.rain_amplitude
						* sin(
							i * evolution.rain_station_radians + time * evolution.rain_time_radians
						)
					)
				),
				evolution.rain_minimum,
				evolution.rain_maximum
			)
		)
		for j in range(LANES):
			var s = col.lanes[j]
			var drainage = maxf(
				evolution.drainage_minimum,
				1 + col.camber * (j - 3) / 3.0 * evolution.drainage_camber
			)
			var evaporation = (
				evolution.evaporation_base
				+ (
					(s.temperature - evolution.evaporation_reference_c)
					* evolution.evaporation_temperature
				)
			)
			s.water = clampf(
				(
					s.water
					+ (
						(
							local_rain * evolution.water_arrival * (1 - s.water)
							- (
								evolution.water_drainage
								* drainage
								* (evolution.water_drainage_base + sqrt(s.water))
							)
							- (
								evaporation
								* (
									1.0
									if local_rain < evolution.rain_threshold
									else evolution.wet_evaporation
								)
							)
						)
						* dt
					)
				),
				0,
				1
			)
			s.rubber = maxf(
				0,
				(
					s.rubber
					- (
						s.rubber
						* (
							local_rain * evolution.rain_rubber_wash
							+ s.water * evolution.water_rubber_wash
						)
						* dt
					)
				)
			)
			s.dust = maxf(0, s.dust - local_rain * evolution.dust_wash * dt)
			s.marbles = maxf(0, s.marbles - local_rain * evolution.marbles_wash * dt)
			s.oil = maxf(0, s.oil - dt * (local_rain * evolution.oil_wash + evolution.oil_decay))
			s.debris = maxf(0, s.debris - dt * evolution.debris_decay)
			s.temperature = lerpf(
				s.temperature,
				(
					evolution.wet_temperature_c
					if local_rain > evolution.rain_threshold
					else evolution.dry_temperature_c
				),
				minf(1, dt * evolution.temperature_response)
			)


static func deposit(
	grid: Array,
	length_m: float,
	c: RaceCar,
	from: float,
	to: float,
	curve: float,
	rules: Dictionary = LegacyEnvironment.VALUES.surface
) -> Array[int]:
	var parameters: Dictionary = rules.contact
	var touched: Array[int] = []
	var distance = maxf(0, to - from)
	if distance == 0:
		return touched
	var count = maxi(1, ceili(distance / 12.0))
	var weight = distance / count / (length_m / STATIONS)
	for k in range(count):
		var fraction = fposmod(lerpf(from, to, (k + 0.5) / count) / length_m, 1.0)
		var i = int(fraction * STATIONS)
		var col = grid[i]
		var at = lane_value(col, c.lane)
		if i not in touched:
			touched.append(i)
		for j in range(LANES):
			var contact = exp(-0.5 * ((j - at) / parameters.width_strips) ** 2)
			if contact < 0.004:
				continue
			var s = col.lanes[j]
			s.rubber = minf(
				1, s.rubber + weight * contact * parameters.rubber_deposit * (1 - s.water) ** 2
			)
			s.water = maxf(
				0,
				(
					s.water
					- (
						weight
						* contact
						* (
							parameters.wet_water_clearance
							if c.tyre_rules.wet(c.compound)
							else parameters.dry_water_clearance
						)
					)
				)
			)
			s.dust = maxf(0, s.dust - weight * contact * parameters.dust_clearance)
			s.marbles = maxf(0, s.marbles - weight * contact * parameters.marbles_clearance)
			s.temperature = minf(
				parameters.temperature_limit_c,
				(
					s.temperature
					+ (
						weight
						* contact
						* (
							parameters.temperature_gain_c
							+ c.braking * parameters.braking_temperature_c
						)
					)
				)
			)
		var outside = clampi(floori(at) - 2 if curve > 0 else ceili(at) + 2, 0, LANES - 1)
		col.lanes[outside].marbles = minf(
			1,
			(
				col.lanes[outside].marbles
				+ (
					weight
					* parameters.outside_marbles
					* (parameters.push_marbles_factor if c.pace == 2 else 1.0)
				)
			)
		)
	return touched


static func contaminate(
	grid: Array,
	fraction: float,
	lane: float,
	severity: float,
	oil: bool,
	rules: Dictionary = LegacyEnvironment.VALUES.surface.incident
) -> void:
	for offset in [-1, 0, 1]:
		var col = grid[posmod(int(fposmod(fraction, 1.0) * STATIONS) + offset, STATIONS)]
		var s = col.lanes[roundi(lane_value(col, lane))]
		s.debris = minf(
			1, s.debris + severity * (1.0 if offset == 0 else rules.adjacent_debris_factor)
		)
		if oil:
			s.oil = minf(1, s.oil + rules.oil)


static func profiles(grid: Array, water: Array, rubber: Array, indices: Array = []) -> void:
	var selected: Array = range(STATIONS) if indices.is_empty() else indices
	for i in selected:
		var value = within(grid[i], grid[i].line)
		water[i] = value.water
		rubber[i] = value.rubber


static func valid(grid: Variant, water: Array, rubber: Array) -> bool:
	if not grid is Array or grid.size() != STATIONS:
		return false
	for i in range(STATIONS):
		var col = grid[i]
		if not col is Dictionary or not col.get("lanes") is Array or col.lanes.size() != LANES:
			return false
		if (
			not TrackDocument.valid_number(col.get("width"), 1, 100)
			or not TrackDocument.valid_number(col.get("camber"), -1, 1)
			or not TrackDocument.valid_number(col.get("line"), -50, 50)
		):
			return false
		for s in col.lanes:
			if not s is Dictionary:
				return false
			for key in CHANNELS:
				if not TrackDocument.valid_number(
					s.get(key), 0, 100 if key == "temperature" else 1
				):
					return false
		var value = within(col, col.line)
		if (
			not TrackDocument.valid_number(water[i], 0, 1)
			or not TrackDocument.valid_number(rubber[i], 0, 1)
		):
			return false
		if absf(value.water - water[i]) > 0.00001 or absf(value.rubber - rubber[i]) > 0.00001:
			return false
	return true
