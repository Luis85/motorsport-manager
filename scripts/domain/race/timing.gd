class_name RaceTiming
extends RefCounted
## Timing and classification rules. Pure domain service; no renderer or file access.
## Invoke cross-system work through the aggregate so inherited rule-set hooks remain active.


static func qualifying_crossings(
	sim: RaceSimPort, car: RaceCar, before: float, after: float
) -> void:
	if car.qual_state == "hotlap":
		var base_lap = int(floor(before / sim.track.length))
		for i in range(3):
			var gate: float = base_lap * sim.track.length + sim.track.sector_ends[i]
			if before < gate and after >= gate:
				var at = (
					sim.clock - RaceSimPort.STEP * (after - gate) / maxf(0.000001, after - before)
				)
				car.qual_sectors[i] = maxf(0, at - car.qual_sector_start)
				car.qual_sector_start = at
				car.sectors = car.qual_sectors.duplicate()
	if floor(before / sim.track.length) == floor(after / sim.track.length):
		return
	var boundary = floor(after / sim.track.length) * sim.track.length
	var crossed_at = (
		sim.clock - RaceSimPort.STEP * (after - boundary) / maxf(0.000001, after - before)
	)
	if car.qual_state == "outlap":
		if sim.qual_closed:
			car.qual_state = "inlap"
		else:
			car.qual_state = "hotlap"
			car.hot_start = crossed_at
			car.hot_valid = true
			car.invalid_reason = ""
			car.qual_sectors = [0.0, 0.0, 0.0]
			car.qual_sector_start = crossed_at
	elif car.qual_state == "hotlap":
		var time = crossed_at - car.hot_start
		car.qual_history.append(
			{
				"run": car.qual_runs,
				"time": time,
				"sectors": car.qual_sectors.duplicate(),
				"valid": car.hot_valid,
				"reason": car.invalid_reason,
				"compound": car.compound
			}
		)
		if car.qual_history.size() > 100:
			car.qual_history.pop_front()
		if car.hot_valid and time > 1:
			car.qual_laps += 1
			car.last_lap = time
			if car.qual_best == 0 or time < car.qual_best:
				car.qual_best = time
			sim.post(
				"lap", "%s sets %s in qualifying." % [car.short, RaceSimPort.format_time(time)]
			)
		else:
			sim.post("lap", "%s flying lap invalid: %s." % [car.short, car.invalid_reason])
		car.qual_state = "inlap"
		car.pit_gate = -1.0


static func finish_qualifying(sim: RaceSimPort) -> void:
	var order = sim.standings(true)
	for i in range(order.size()):
		order[i].grid = i + 1
	sim.transition("qualifying_results")


static func race_crossings(sim: RaceSimPort, car: RaceCar, before: float, after: float) -> void:
	if car.finished or car.dnf:
		return
	var base_lap = int(floor(maxf(0, before) / sim.track.length))
	for lap_index in range(base_lap, base_lap + 2):
		for i in range(3):
			var gate = lap_index * sim.track.length + sim.track.sector_ends[i]
			if before < gate and after >= gate:
				var at = (
					sim.clock - RaceSimPort.STEP * (after - gate) / maxf(0.000001, after - before)
				)
				car.sectors[i] = at - car.sector_start
				car.sector_start = at
	if (
		floor(before / sim.track.length) == floor(after / sim.track.length)
		or after < sim.track.length
	):
		return
	car.completed = int(floor(after / sim.track.length))
	var boundary = car.completed * sim.track.length
	var crossed_at = (
		sim.clock - RaceSimPort.STEP * (after - boundary) / maxf(0.000001, after - before)
	)
	car.last_lap = crossed_at - car.lap_start
	car.lap_start = crossed_at
	if not car.pit_lap and (car.best_lap == 0 or car.last_lap < car.best_lap):
		car.best_lap = car.last_lap
	if not car.pit_lap and (sim.fastest == 0 or car.last_lap < sim.fastest):
		sim.fastest = car.last_lap
	car.history.append(
		{
			"lap": car.completed,
			"time": car.last_lap,
			"compound": car.compound,
			"pit_lap": car.pit_lap,
			"sectors": car.sectors.duplicate()
		}
	)
	car.pit_lap = car.route == "pit"
	if car.history.size() > 110:
		car.history.pop_front()
	car.crossed_at = crossed_at


static func resolve_finishes(sim: RaceSimPort) -> void:
	# Resolve every crossing in the tick by interpolated timestamp, not car iteration order.
	var flag_at = -INF if sim.chequered else INF
	if not sim.chequered:
		for car in sim.cars:
			if car.crossed_at >= 0 and car.completed >= sim.laps and not car.dnf:
				flag_at = minf(flag_at, car.crossed_at)
		if is_finite(flag_at):
			sim.chequered = true
			sim.post("flag", "Chequered flag. Cars finish at their next crossing.")
	if not sim.chequered:
		return
	var pending: Array = []
	for car in sim.cars:
		if not car.dnf and not car.finished and car.crossed_at >= 0 and car.crossed_at >= flag_at:
			pending.append(car)
	pending.sort_custom(
		func(a, b):
			return a.crossed_at < b.crossed_at if a.crossed_at != b.crossed_at else a.grid < b.grid
	)
	for car in pending:
		sim.finish_count += 1
		car.finished = true
		car.finish_position = sim.finish_count
		car.finish_time = car.crossed_at
		car.speed = 0.0
		sim.post(
			"finish", "%s takes the chequered flag after %d laps." % [car.short, car.completed]
		)
	var classified = sim.standings()
	for i in range(classified.size()):
		if classified[i].finished:
			classified[i].finish_position = i + 1


static func standings(sim: RaceSimPort, qualifying: bool = false) -> Array:
	var order = sim.cars.duplicate()
	order.sort_custom(
		func(a, b):
			if qualifying:
				if a.qual_best == 0 or b.qual_best == 0:
					if a.qual_best == b.qual_best:
						return a.grid < b.grid
					return a.qual_best > 0
				return a.qual_best < b.qual_best
			if a.dnf != b.dnf:
				return not a.dnf
			if a.finished and b.finished:
				if a.completed != b.completed:
					return a.completed > b.completed
				if a.finish_time != b.finish_time:
					return a.finish_time < b.finish_time
				return a.grid < b.grid
			if absf(a.distance - b.distance) < 0.0001:
				return a.grid < b.grid
			return a.distance > b.distance
	)
	return order
