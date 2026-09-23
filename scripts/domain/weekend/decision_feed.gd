class_name DecisionFeed
extends RefCounted
## Read-only decisions. Stable driver slots are a UI responsibility; no sorting under focus.

static func for_driver(sim: RaceSim, id: int, policy: Dictionary, forecast: Dictionary) -> Array:
	var c = sim.cars[id]
	var key = RaceForecaster.material_key(sim, id, int(policy.revision))
	var fallback = "Ignored: the current manual pit plan stays unchanged." if policy.owners.pit == "player" else "Ignored: the engineer keeps the authorized plan and emergency policy."
	var cards: Array = []
	if c.dnf or c.finished: return cards
	if sim.phase == "qualifying" and c.route == "garage":
		var release = RaceForecaster.qualifying_release(sim, c)
		cards.append(card(id, "qualifying", 40, "Bank a lap or retain the set", "Estimated %.0fs to start a flying lap. %s" % [release.required_seconds, "A release is still feasible." if release.can_start_hotlap else "Too late for another timed attempt."], key, "Ignored: the current qualifying owner retains control.", release.latest_release - sim.clock))
	if sim.phase != "race": return finalize(cards, policy, key, sim)
	var fitted = TyreInventory.find(c, c.set_id)
	if not WheelTyres.usable(fitted): cards.append(card(id, "tyre", 100, "Damaged tyre: choose a recovery", "The fitted set has an unusable wheel. A stop costs time; continuing risks retirement.", key, fallback))
	var margin = RaceForecaster.fuel_margin(sim, c)
	if margin < 0: cards.append(card(id, "fuel", 95, "Projected fuel shortfall", "Estimate %.1f lap-equivalent units at the current engine policy. Saving reduces power and consumption." % margin, key, "Ignored: the current engine owner and policy remain in effect."))
	if policy.plan_status == "blocked": cards.append(card(id, "plan", 90, "The approved plan needs attention", policy.blocked_reason, key, fallback))
	if c.route == "pit" or c.pit_order: return finalize(cards, policy, key, sim)
	if forecast.is_empty() or RaceForecaster.stale(sim, forecast, int(policy.revision)): return finalize(cards, policy, key, sim)
	for option in forecast.options:
		if option.id == "box" and option.available and (option.gain > 3 or c.tyre < 28):
			var description = "Model estimate: %+.1fs versus the current plan; %s finish risk. Rejoin P%d–P%d; rival stops may change it." % [option.gain, option.risk, forecast.pit.position_low, forecast.pit.position_high]
			if forecast.pit.queue > 0: description += " Shared-box wait ~%.1fs." % forecast.pit.queue
			if not forecast.pit.traffic.is_empty(): description += " Possible traffic: " + ", ".join(forecast.pit.traffic) + "."
			cards.append(card(id, "pit", 60, "Compare the next safe pit entry", description, key, fallback, forecast.gate.deadline))
	return finalize(cards, policy, key, sim)

static func finalize(cards: Array, policy: Dictionary, key: String, sim: RaceSim) -> Array:
	for entry in cards:
		entry.dedup_key = acknowledgement_key(sim, int(entry.driver_id), entry.issue, policy)
		entry.acknowledged = policy.held.get(entry.issue, "") == entry.dedup_key
	cards.sort_custom(func(a, b): return a.priority > b.priority)
	return cards

static func card(id: int, issue: String, priority: int, title: String, evidence: String, key: String, fallback: String, deadline: float = -1) -> Dictionary:
	return {"driver_id": id, "issue": issue, "priority": priority, "title": title, "evidence": evidence,
		"key": key, "fallback": fallback, "deadline": maxf(-1, deadline), "acknowledged": false}

static func deadline_text(card_record: Dictionary, sim: RaceSim) -> String:
	if card_record.deadline < 0: return "Review when ready; time remains under your control."
	if sim.paused: return "Decision window ~%.0fs simulated · paused by you." % card_record.deadline
	return "Window ~%.0fs simulated / %.1fs at %d×. Pause explicitly for reading time." % [card_record.deadline, card_record.deadline / sim.speed, sim.speed]

static func primary(cards: Array) -> Dictionary:
	for entry in cards:
		if not entry.acknowledged: return entry
	return {}

static func acknowledgement_key(sim: RaceSim, id: int, issue: String, policy: Dictionary) -> String:
	var c = sim.cars[id]
	var facts: Array = [issue, sim.phase]
	match issue:
		"fuel": facts.append([floorf(RaceForecaster.fuel_margin(sim, c)), c.engine, policy.owners.engine])
		"tyre": facts.append([c.set_id, WheelTyres.usable(TyreInventory.find(c, c.set_id)), policy.owners.pit, c.pit_order])
		"plan": facts.append([policy.revision, policy.blocked_reason, policy.owners.pit])
		"qualifying": facts.append([c.qual_runs, RaceForecaster.qualifying_release(sim, c).can_start_hotlap, policy.owners.qualifying])
		_: return RaceForecaster.material_key(sim, id, int(policy.revision))
	return JSON.stringify(facts).sha256_text()
