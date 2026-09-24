class_name WeekendScenarios
extends RefCounted
## Disclosed initial conditions, never scripts that force a race outcome.
static func catalog() -> Array:
	var result = Storage.read_json("res://data/scenarios/dry-strategy.json")
	if not result.ok or not result.data is Dictionary or result.data.get("version") != 1 or not result.data.get("scenarios") is Array: return []
	return result.data.scenarios

static func valid(recipe: Variant) -> bool:
	if not recipe is Dictionary: return false
	for key in ["id", "title", "track", "objective", "hint"]:
		if not recipe.get(key) is String or recipe[key].is_empty(): return false
	if not RaceCheckpoint.integral(recipe.get("laps"), 4, 100) or not RaceCheckpoint.integral(recipe.get("seed"), 0, 4294967295): return false
	if not recipe.get("plans") is Array or recipe.plans.size() != 2: return false
	var ids: Array = []
	for plan in recipe.plans:
		if not plan is Dictionary or not RaceCheckpoint.integral(plan.get("driver_id"), 0, 11) or int(plan.driver_id) not in [3, 6] or int(plan.driver_id) in ids: return false
		ids.append(int(plan.driver_id))
		if not plan.get("starting") is String or plan.get("objective") not in StrategyPlan.OBJECTIVES: return false
		if plan.has("replacement"):
			if not plan.replacement is String or not RaceCheckpoint.integral(plan.get("first"), 1, recipe.laps - 1) or not RaceCheckpoint.integral(plan.get("last"), plan.first, recipe.laps - 1): return false
	return true

static func build(recipe: Dictionary, library: Array) -> StrategyRaceSim:
	if not valid(recipe): return null
	var document: Dictionary = {}
	for track in library:
		if track.id == recipe.track: document = track; break
	if document.is_empty(): return null
	var geometry = TrackGeometry.new(document, "Formula")
	if TrackDiagnostics.blocking(TrackDiagnostics.inspect(geometry)): return null
	var sim = StrategyRaceSim.new(geometry, {"laps": int(recipe.laps), "seed": int(recipe.seed), "scenario": "dry", "intensity": "calm"})
	RaceJournal.append(sim.strategy_state, sim, "scenario", -1, {"id": recipe.id, "title": recipe.title, "objective": recipe.objective, "hint": recipe.hint,
		"track_hash": JSON.stringify(geometry.document).sha256_text(), "ruleset": "native-0.4-physics", "assists": "Engineer-owned domains; explicit approved plans; dry; calm incidents; no outcome script."})
	for entry in recipe.plans:
		var id = int(entry.driver_id)
		var plan = StrategyPlan.draft(sim.cars[id], sim.laps, "no_stop")
		plan.starting_set = "%d-%s" % [id, entry.starting]; plan.objective = entry.objective
		if entry.has("replacement"): plan.stops = [{"from_lap": int(entry.first), "to_lap": int(entry.last), "set_id": "%d-%s" % [id, entry.replacement]}]
		if not sim.command("approve_plan", {"id": id, "revision": 0, "plan": plan, "issuer": "scenario_initialization"}): return null
	return sim

static func briefing(sim: StrategyRaceSim) -> String:
	var p = RaceForecaster.pit_prediction(RaceForecaster.capture(sim, 3))
	var low = INF; var high = 0.0
	for width in sim.track.widths: low = minf(low, width); high = maxf(high, width)
	var text = "TEAM OBJECTIVE · Bring both cars home.\n%dlaps · %s reference lap · authored road width %.1f–%.1fm.\nEstimated net pit loss %.0f–%.0fs. No race refuelling or mandatory stop; allocations are driver-owned.\nDry / wet scenarios are fictional rules, not licensed series procedures." % [sim.laps, RaceSim.format_time(sim.track.estimate), low, high, p.loss_low, p.loss_high]
	for record in sim.strategy_state.records:
		if record.kind == "scenario":
			text = "%s\n%s\n%s\n%s\n\n%s" % [record.evidence.title, record.evidence.objective, record.evidence.hint, record.evidence.assists, text]
			break
	return text

static func team_result(sim: StrategyRaceSim) -> String:
	if sim.phase != "results": return "TEAM OBJECTIVE · Bring both cars home. Result is pending."
	var both = sim.cars[3].finished and sim.cars[6].finished and not sim.cars[3].dnf and not sim.cars[6].dnf
	var lines: Array[String] = ["TEAM OBJECTIVE · " + ("Both cars brought home." if both else "Both-car finish not achieved. No result is fabricated or awarded for commands alone.")]
	var order = sim.standings()
	for id in [3, 6]:
		var c = sim.cars[id]
		lines.append("%s · %s · %d completed laps · %d actual stops" % [c.short, "Retired: " + c.retire_reason if c.dnf else "P%d (grid P%d)" % [order.find(c) + 1, c.grid], c.completed, c.pit_stops])
	return "\n".join(lines)
