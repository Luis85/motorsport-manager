class_name RaceContestReadModel
extends RefCounted
## Pure, observed battle state shared by the canvas and race reading.

static func observed_contest(sim: StrategyRaceSim, id: int) -> Dictionary:
	# Presentation-only: never infer a contest from screen-space proximity or RNG.
	if sim.phase != "race" or id < 0 or id >= sim.cars.size(): return {}
	var record: Dictionary = sim.battle_state.drivers[id]
	if not _active_pair(sim, record):
		record = {}
		for candidate in sim.battle_state.drivers:
			if int(candidate.target_id) == id and _active_pair(sim, candidate):
				record = candidate; break
	return record.duplicate(true)

static func _active_pair(sim: StrategyRaceSim, record: Dictionary) -> bool:
	if record.is_empty() or record.phase in ["idle", "recover", "resolve"]: return false
	var id = int(record.driver_id); var target = int(record.target_id)
	if id < 0 or target < 0 or id >= sim.cars.size() or target >= sim.cars.size(): return false
	for car in [sim.cars[id], sim.cars[target]]:
		if car.route != "track" or car.dnf or car.finished: return false
	return true
