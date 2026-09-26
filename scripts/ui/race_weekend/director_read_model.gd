class_name DirectorReadModel
extends RefCounted
## Small, read-only summaries. Never reads future weather or private rival resources.
static func chapter(phase: String) -> Array:
	match phase:
		"briefing": return ["01 / PREPARE", "Learn what matters. Save what you need.", "Practice is optional and spends real tyres. Build a plan or go straight to qualifying."]
		"practice", "practice_results": return ["01 / LEARN", "Trade running time for useful evidence.", "Use the practice dashboard to compare clean runs. There is no hidden setup-score bonus."]
		"qualifying": return ["02 / QUALIFY", "Bank a lap, or keep the set?", "Each release spends a real tyre set. Watch the out-lap and leave time for a valid flying lap."]
		"qualifying_results": return ["02 / GRID", "Your starting position is earned.", "Inspect measured laps, then prepare both cars. Qualifying tyre use carries into race planning."]
		"race_preparation", "formation", "grid_ready", "lights": return ["03 / COMMIT", "Two cars. One shared pit box.", "Check the starting sets and pit owners. Formation and the start each require your approval."]
		"race": return ["04 / RACE", "Make a call. Watch the consequence.", "Keep existing orders, send a two-lap radio instruction, or compare a physical pit stop."]
		_: return ["05 / LEARN AGAIN", "The result is evidence, not an explanation.", "Review actual laps and stops. Replay a different decision without overwriting the original result."]

static func car(model: StrategyRaceSim, id: int, forecast: Dictionary = {}) -> Dictionary:
	var c = model.cars[id]
	var policy = model.policy(id)
	var order = model.standings(model.phase in ["qualifying", "qualifying_results"])
	var pos = order.find(c) + 1
	var margin = RaceForecaster.fuel_margin(model, c)
	var issue = DecisionFeed.primary(DecisionFeed.for_driver(model, id, policy, forecast))
	var status = "No new instruction"
	if model.phase == "race":
		if c.route == "pit" or c.pit_order: status = model.pit_status(c)
		elif not issue.is_empty(): status = issue.title
		else: status = "Keep your orders · watch the next stint"
	elif model.phase == "qualifying": status = str(c.qual_state).replace("_", " ").capitalize()
	elif model.phase in ["briefing", "race_preparation"]: status = "Choose a plan before committing"
	if c.dnf: status = "RETIRED · " + c.retire_reason
	elif c.finished: status = "FINISHED · P%d" % c.finish_position
	var plan = "No approved pit plan"
	if not policy.plan.is_empty():
		var stops: Array = model.active_plan(id).get("stops", [])
		plan = "No further stop planned" if stops.is_empty() else "Pit window L%d–%d" % [stops[0].from_lap, stops[0].to_lap]
	if policy.get("plan_status", "") == "overridden": plan = "Pit plan overridden"
	plan += " · " + ("engineer" if policy.owners.get("pit") == "engineer" else "you")
	var rival = "No car ahead"
	if pos > 1 and pos <= order.size():
		var ahead: Dictionary = order[pos - 2]
		var gap = maxf(0, ahead.distance - c.distance) / maxf(10, c.speed)
		rival = "%s ahead · ~%.1fs" % [ahead.short, gap]
	if model.phase in ["briefing", "race_preparation", "formation", "grid_ready", "lights"]: rival = "Starting P%d" % c.grid
	if model.phase in ["qualifying", "qualifying_results"]:
		rival = "Best %.3fs · %d timed laps" % [c.qual_best,c.qual_laps] if c.qual_best > 0 else "No timed lap recorded"
	elif model.phase in ["practice", "practice_results"]:
		rival = "Measured practice · not a grid position"
	return {"id":id,"name":c.name,"short":c.short,"position":pos,"tyre":c.tyre,"set":c.set_id,
		"fuel":c.fuel,"compound":c.compound,"fuel_margin":margin,"status":status,"plan":plan,"rival":rival,
		"issue":issue,"terminal":c.dnf or c.finished,"owner":policy.owners.get("pit", "player")}

static func spotlight(model: StrategyRaceSim, forecasts: Dictionary) -> Dictionary:
	var headline = chapter(model.phase)
	var value = {"eyebrow":headline[0],"title":headline[1],"detail":headline[2],"id":3,"priority":0}
	for id in [3, 6]:
		var reading = car(model,id,forecasts.get(id,{}))
		var issue: Dictionary = reading.issue
		if not issue.is_empty() and int(issue.priority) > int(value.priority):
			value = {"eyebrow":"DECISION / " + reading.short, "title":issue.title,
				"detail":issue.evidence,"id":id,"priority":issue.priority}
	return value
