class_name MinimalRaceTiming
extends RefCounted
## Public classification only. No tyre/telemetry fields or hidden rival state.
static func practice_best(sim: PracticeRaceSim, id: int) -> float:
	var best = 0.0
	for run in sim.practice_driver(id).runs:
		for lap in run.samples:
			if best == 0 or lap.seconds < best: best = lap.seconds
	return best

static func rows(sim: PracticeRaceSim) -> Array:
	var practice = sim.phase in ["practice", "practice_results"]
	var qualifying = sim.phase in ["qualifying", "qualifying_results"]
	var order = sim.standings(qualifying)
	var times = {}
	if practice:
		for car in order: times[car.id] = practice_best(sim, car.id)
		order.sort_custom(func(a, b):
			if times[a.id] == times[b.id]: return a.grid < b.grid
			if times[a.id] == 0: return false
			if times[b.id] == 0: return true
			return times[a.id] < times[b.id])
	var output: Array = []; var leader = order[0]
	for i in range(order.size()):
		var car = order[i]; var value = "Leader" if i == 0 else "~+%.1f" % (maxf(0, leader.distance - car.distance) / maxf(15, car.speed))
		if practice or qualifying: value = RaceSim.format_time(times[car.id] if practice else car.qual_best)
		elif sim.phase in ["briefing", "race_preparation", "formation", "grid_ready", "lights"]: value = "Grid %d" % car.grid
		elif car.finished: value = "Winner" if i == 0 else ("+%d L" % (leader.completed - car.completed) if car.completed < leader.completed else "+%.3f" % (car.finish_time - leader.finish_time))
		elif leader.distance - car.distance >= sim.track.length: value = "+%d L" % int((leader.distance - car.distance) / sim.track.length)
		if car.dnf: value = "DNF"
		var status = state(sim, car)
		output.append({"id": car.id, "position": i + 1, "name": car.short + (" *" if car.player else ""), "time": value, "state": status, "tooltip": car.name + " · " + status})
	return output

static func state(sim: PracticeRaceSim, car: Dictionary) -> String:
	if car.dnf: return "Retired"
	if car.finished: return "Finished"
	if car.route == "garage": return "Garage"
	if car.route == "pit": return "Pit stop" if car.pit_stage == "service" else ("Pit exit" if car.pit_stage == "exit" else "Pit entry")
	if sim.phase in ["practice", "qualifying"]: return {"outlap": "Out lap", "hotlap": "Flying lap", "inlap": "In lap"}.get(car.qual_state, "On track")
	if sim.phase in ["briefing", "race_preparation", "grid_ready"]: return "Ready"
	if sim.phase in ["formation", "lights"]: return "Formation" if sim.phase == "formation" else "On grid"
	if car.pit_order: return "Box this lap"
	return "Racing"
