class_name RaceReadModel
extends RefCounted
## Observational race storytelling. No commands, new pit forecasts, random draws or persistence.
## Inputs are current own-car facts, public track movement and optional existing estimates.
const RECENT_SCAN_LIMIT = 128
const RECENT_LIMIT = 4

static func capture(model: StrategyRaceSim, forecasts: Dictionary = {}) -> Dictionary:
	var drivers: Array = []
	for id in [3, 6]: drivers.append(driver_story(model, id, forecasts.get(id, {})))
	var focus: Dictionary = drivers[0]
	for driver in drivers:
		if driver.priority > focus.priority: focus = driver
	return {"phase":model.phase, "time":model.total_time, "paused":model.paused,
		"speed":model.speed, "drivers":drivers, "focus":focus.duplicate(true),
		"recent":recent_evidence(model), "truncated":bool(model.strategy_state.get("truncated", false))}

static func story(id: int, priority: int, title: String, evidence: String, choice: String, next: String) -> Dictionary:
	return {"driver_id":id, "priority":priority, "title":title, "evidence":evidence,
		"choice":choice, "next":next}

static func driver_story(model: StrategyRaceSim, id: int, forecast: Dictionary) -> Dictionary:
	var car = model.cars[id]
	var policy = model.policy(id)
	var result: Dictionary
	if car.dnf:
		result = story(id, 5, "Retired", car.retire_reason if not car.retire_reason.is_empty() else "Retirement recorded; no further orders are available.", "Protect the other driver's race rather than issuing orders to a retired car.", "Review / Debrief retains the actual outcome.")
	elif car.finished:
		result = story(id, 5, "Finished", "Grid P%d → finish P%d." % [car.grid, car.finish_position] if car.finish_position > 0 else "Finished; classification is not yet recorded.", "A position change is an outcome, not proof that a specific command caused it.", "Review / Results compares accepted decisions with measured evidence.")
	elif model.phase == "qualifying":
		var release = RaceForecaster.qualifying_release(model, car)
		var best = "No valid timed lap yet." if car.qual_best <= 0 else "Best valid lap " + RaceSim.format_time(car.qual_best) + "."
		var state = {"garage":"In the garage", "outlap":"Preparing a flying lap", "hotlap":"Timed lap in progress", "inlap":"Returning to the garage"}.get(car.qual_state, "Qualifying run")
		var choice = "Bank a time now or retain tyre life and wait for a different track window."
		if car.qual_state != "garage": choice = "Let the run complete or explicitly recall it; recall abandons a current timed attempt."
		if car.qual_state == "hotlap" and not car.hot_valid: best += " Current lap is invalid."
		result = story(id, 40 if car.qual_best <= 0 else 20, state, best, choice, "Another release: " + ("still feasible under the estimate." if release.can_start_hotlap else "too late to start a flying lap under the estimate."))
	elif model.phase in ["practice", "practice_results"]:
		result = story(id, 10, "Build useful evidence", "Practice consumes the actual allocated tyres and fuel; it is not a free performance bonus.", "Choose a comparable run or preserve resources. Read measured evidence before changing the plan.", "Practice / Evidence distinguishes measured, excluded and uncertain observations.")
	elif model.phase != "race":
		result = story(id, 10, "Prepare the next decision", "Current stage: " + model.phase.replace("_", " ") + ".", "Check the fitted set, fuel and ownership for both drivers before the next explicit approval.", "The header's next-session action advances the weekend only when you approve it.")
	else:
		result = race_story(model, id, policy, forecast)
	result.name = car.name; result.short = car.short
	return result

static func race_story(model: StrategyRaceSim, id: int, policy: Dictionary, forecast: Dictionary) -> Dictionary:
	var car = model.cars[id]
	var issue = DecisionFeed.primary(DecisionFeed.for_driver(model, id, policy, forecast))
	if not issue.is_empty() and int(issue.priority) >= 90:
		return story(id, int(issue.priority), issue.title, issue.evidence, issue.fallback, "Review this driver's decision card. " + DecisionFeed.deadline_text(issue, model))
	if car.route == "pit":
		return story(id, 80, "The stop is unfolding", model.pit_status(car), "The accepted visit is now physical; cancellation is closed after pit entry.", "Watch Team / Pit service. Service completion is not yet a measured pit exit.")
	if car.pit_order:
		return story(id, 75, "Approaching the accepted stop", "A physical pit order is active, not just a draft window.", "Retain the call or explicitly cancel before pit entry; the current order does not change by reading this.", "Watch the named driver's approach, then the shared box and actual rejoin.")
	if not issue.is_empty():
		return story(id, int(issue.priority), issue.title, issue.evidence, "Pit for the proposed tyre opportunity, or stay out and preserve the option. Neither is guaranteed to be faster.", "Compare the alternatives and rejoin range. " + DecisionFeed.deadline_text(issue, model))
	var contest = RaceContestReadModel.observed_contest(model, id)
	if not contest.is_empty():
		var attacker = model.cars[int(contest.driver_id)]; var defender = model.cars[int(contest.target_id)]
		var title = "Defending from " + attacker.short if id == int(defender.id) else RacecraftController.LABELS[contest.phase] + " " + defender.short
		return story(id, 55, title, "An active on-track contest is observed; neither a pass nor a defence is guaranteed.", "Balance a short pace effort against tyre and fuel cost. Current control ownership remains in effect.", "Watch for completed overlap and clearance; Review / Decisions records completed passes.")
	var remaining = maxf(0, float(model.laps) - car.distance / model.track.length)
	if remaining <= 2.0:
		return story(id, 45, "Closing laps", "~%.1f distance laps remain for this car; fuel margin is an estimate, not a guarantee." % remaining, "Protect the finish or spend remaining resources on pace. The final classification is still open.", "Watch the line crossing and measured result; no artificial close finish is applied.")
	var position = model.standings(false).find(car) + 1
	var plan = "No approved strategy; current owners still control the car." if policy.plan.is_empty() else "Plan status: " + str(policy.plan_status) + "."
	return story(id, 10, "P%d · let the stint develop" % position, plan,
		"Staying out is a decision: preserve tyre life and options rather than reacting to every tick.",
		"Review again at the next pit window, material weather change, fuel warning or genuine contest.")

static func recent_evidence(model: StrategyRaceSim) -> Array:
	var result: Array = []
	var records: Array = model.strategy_state.records
	# Bounded recent window, not a scan or clone of a 50,000-row journal each refresh.
	for i in range(records.size() - 1, maxi(-1, records.size() - RECENT_SCAN_LIMIT - 1), -1):
		var record: Dictionary = records[i]
		if int(record.driver_id) not in [3, 6] or record.provenance != "observed": continue
		var evidence: Dictionary = record.evidence
		var text = ""
		match record.kind:
			"pit_exit": text = "Pit exit recorded · %.2fs total visit · %s. This is not net race-time loss." % [evidence.visit_seconds, evidence.fitted_set]
			"pass_completed":
				var target = int(evidence.get("target_id", -1))
				if target >= 0 and target < model.cars.size(): text = "Pass completed on " + model.cars[target].short + " with recorded physical clearance."
			"handback": text = str(evidence.get("reason", "Control handback recorded.")) + ". Handback alone does not measure fuel or time saved."
		if text.is_empty(): continue
		result.append({"id":record.id, "time":record.time, "driver":model.cars[int(record.driver_id)].short, "text":text})
		if result.size() == RECENT_LIMIT: break
	return result

static func reading(snapshot: Dictionary) -> String:
	var lines: Array[String] = ["READING SNAPSHOT · %s · %.1f simulated seconds · %s" % [str(snapshot.phase).replace("_", " "), snapshot.time, "paused by you" if snapshot.paused else "running at %d×" % snapshot.speed]]
	# Put both drivers and their stakes before the longer evidence and caveats.
	var headlines: Array[String] = []
	for driver in snapshot.drivers: headlines.append("%s / %s — %s" % [driver.short, driver.name, driver.title])
	lines.append("\n".join(headlines))
	for driver in snapshot.drivers:
		lines.append("%s / %s\n%s\n\nEvidence: %s\n\nChoice: %s\n\nNext: %s" % [driver.short, driver.name, driver.title, driver.evidence, driver.choice, driver.next])
	lines.append("RECENT OBSERVED EVIDENCE\nLatest %d relevant records from the last %d retained journal entries; this is not a complete race history." % [RECENT_LIMIT, RECENT_SCAN_LIMIT])
	if snapshot.recent.is_empty(): lines.append("No matching observed outcome in this recent window. Accepted orders are not completed results.")
	for item in snapshot.recent: lines.append("%.1fs · %s · %s\n%s" % [item.time, item.driver, item.id, item.text])
	if snapshot.truncated: lines.append("Journal retention limit reached. Later outcomes may be unavailable; do not infer their absence from this view.")
	lines.append("Reading does not pause, issue orders or change camera selection. Estimates explain choices; only recorded outcomes establish what happened.\n\nOpen Review / Decisions for the retained chain or Review / Radio for messages. Close and reopen this reading to refresh it. Rival tyre condition, fuel and future plans remain private.")
	return "\n\n".join(lines)
