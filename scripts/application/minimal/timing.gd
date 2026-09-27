class_name MinimalRaceTiming
extends RefCounted
## Pure public read model. Ordering never writes to cars or their classification.
const TIMED = ["practice", "practice_results", "qualifying", "qualifying_results"]
const GRID = ["briefing", "race_preparation", "formation", "grid_ready", "lights"]

static func format_time(value: float) -> String:
	if not is_finite(value) or value <= 0: return "—"
	# Round before splitting, so 59.9996 is 1:00.000, never 0:60.000.
	var ms = roundi(value * 1000)
	return "%d:%02d.%03d" % [ms / 60000, (ms / 1000) % 60, ms % 1000]

static func practice_best(sim: RaceSim, id: int) -> float:
	var best = 0.0
	for run in sim.practice_driver(id).runs:
		for lap in run.samples:
			if lap.seconds > 0 and (best == 0 or lap.seconds < best): best = lap.seconds
	return best

static func rows(sim: RaceSim) -> Array:
	var practice = sim.phase in ["practice", "practice_results"]
	var timed = sim.phase in TIMED
	var order = sim.standings(); var times = {}
	if order.is_empty(): return []
	if timed:
		for car in order: times[car.id] = practice_best(sim, car.id) if practice else car.qual_best
		order.sort_custom(func(a, b):
			if times[a.id] == times[b.id]: return a.grid < b.grid if a.grid != b.grid else a.id < b.id
			if times[a.id] == 0: return false
			if times[b.id] == 0: return true
			return times[a.id] < times[b.id])
	elif sim.phase in GRID:
		order.sort_custom(func(a, b): return a.grid < b.grid if a.grid != b.grid else a.id < b.id)
	var output: Array = []; var leader = order[0]
	for i in range(order.size()):
		var car = order[i]; var value = "—"
		if timed:
			# A retirement cannot erase a previously completed valid timed lap.
			value = format_time(times[car.id])
		elif sim.phase in GRID: value = "Grid %d" % car.grid
		elif car.dnf: value = "DNF"
		elif car.finished:
			if i == 0: value = "Winner"
			elif leader.finished:
				value = "+%d L" % (leader.completed - car.completed) if car.completed < leader.completed else "+%.3f" % maxf(0, car.finish_time - leader.finish_time)
		elif sim.phase == "race":
			var distance = maxf(0, leader.distance - car.distance)
			value = "Leader" if i == 0 else "~+%.1f" % (distance / maxf(15, car.speed))
			if distance >= sim.track.length: value = "+%d L" % int(distance / sim.track.length)
		var status = state(sim, car)
		output.append({"id": car.id, "position": i + 1, "name": car.short + (" *" if car.player else ""), "time": value,
			"state": status, "tag": tag(status), "player": car.player, "tooltip": car.name + " · " + car.team + " · " + status})
	return output

static func tag(status: String) -> String:
	return {"Retired":"RET", "Finished":"FIN", "Garage":"GAR", "Pit stop":"PIT", "Pit exit":"OUT", "Pit entry":"IN", "Out lap":"OUT", "Flying lap":"FLY", "In lap":"IN", "Ready":"—", "Formation":"FORM", "On grid":"GRID", "Box this lap":"BOX", "Racing":"RUN"}.get(status, "—")

static func state(sim: RaceSim, car: Dictionary) -> String:
	if car.dnf: return "Retired"
	if car.finished: return "Finished"
	if sim.phase in ["briefing", "race_preparation", "grid_ready"]: return "Ready"
	if sim.phase in ["formation", "lights"]: return "Formation" if sim.phase == "formation" else "On grid"
	if car.route == "garage": return "Garage"
	if car.route == "pit": return "Pit stop" if car.pit_stage == "service" else ("Pit exit" if car.pit_stage == "exit" else "Pit entry")
	if sim.phase in ["practice", "qualifying"]: return {"outlap": "Out lap", "hotlap": "Flying lap", "inlap": "In lap"}.get(car.qual_state, "On track")
	if car.pit_order: return "Box this lap"
	return "Racing"
