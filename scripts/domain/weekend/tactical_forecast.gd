class_name TacticalForecast
extends RefCounted
## Pure comparisons over the same permitted-information snapshot as ordinary strategy.
## No probabilities, hidden rival resources, future weather, commands or RNG.
const KINDS = ["undercut", "extend"]
const LABELS = {"undercut": "Undercut this rival", "extend": "Extend for an opportunity"}
const AUTHORITIES = ["recommend", "execute"]

static func target_for(sim: RaceSim, id: int) -> int:
	var own = sim.cars[id]
	var best = -1
	var gap = INF
	for c in sim.cars:
		if c.team == own.team or c.dnf or c.finished: continue
		var distance = absf(c.distance - own.distance)
		if distance < gap: best = int(c.id); gap = distance
	return best

static func draft(sim: StrategyRaceSim, id: int, kind: String = "undercut") -> Dictionary:
	var c = sim.cars[id]
	var first = RaceForecaster.reachable_gate(sim, c).lap if sim.phase == "race" else maxi(2, int(sim.laps * 0.4))
	var source = RaceForecaster.capture(sim, id)
	var item = RaceForecaster.replacement(source)
	return {"kind": kind, "target_id": target_for(sim, id), "set_id": item.get("id", ""),
		"from_lap": first, "to_lap": mini(sim.laps - 1, first + (3 if kind == "extend" else 1)),
		"wait_laps": 2, "authority": "recommend", "fuel_reserve": 0.35,
		"tyre_floor": 15.0, "avoid_traffic": true, "rival_first": true}

static func validate_plan(plan: Variant, cars: Array, id: int, laps: int) -> String:
	if not plan is Dictionary or plan.size() != 11: return "A tactical draft needs the complete supported fields."
	if plan.get("kind") not in KINDS or plan.get("authority") not in AUTHORITIES: return "Choose a tactic and explicit recommendation or pit authority."
	if not RaceCheckpoint.integral(plan.get("target_id"), 0, cars.size() - 1): return "Choose a named rival."
	if cars[int(plan.target_id)].team == cars[id].team: return "A duel targets an opposing driver, not your teammate."
	if not plan.get("set_id") is String or TyreInventory.find(cars[id], plan.set_id).is_empty(): return "Choose a set belonging to this driver."
	if not RaceCheckpoint.integral(plan.get("from_lap"), 1, laps - 1) or not RaceCheckpoint.integral(plan.get("to_lap"), 1, laps - 1): return "The window must be before the final lap."
	if plan.from_lap > plan.to_lap or not RaceCheckpoint.integral(plan.get("wait_laps"), 1, 2): return "Use an ordered window and a one- or two-entry extension."
	if plan.kind == "extend" and plan.from_lap + plan.wait_laps > plan.to_lap: return "The window must leave room for the promised extension."
	if not RaceCheckpoint.number(plan.get("fuel_reserve"), 0, 3) or not RaceCheckpoint.number(plan.get("tyre_floor"), 5, 50): return "Reserve targets are outside the supported range."
	for key in ["avoid_traffic", "rival_first"]:
		if not plan.get(key) is bool: return "Declare each contingency explicitly."
	return ""

static func preview(sim: StrategyRaceSim, id: int, plan: Dictionary) -> Dictionary:
	var result = {"available": false, "reason": "", "time": sim.total_time, "key": "", "driver_id": id,
		"options": [], "pit": {}, "candidate": {}, "target": {}, "gap": 0.0}
	if not RaceCheckpoint.integral(id, 0, sim.cars.size() - 1): result.reason = "Unknown driver."; return result
	var c = sim.cars[id]
	result.key = RaceForecaster.material_key(sim, id, int(sim.policy(id).revision))
	result.reason = validate_plan(plan, sim.cars, id, sim.laps)
	if not result.reason.is_empty(): return result
	if not c.player or c.dnf or c.finished or sim.phase not in ["briefing", "race_preparation", "race"]:
		result.reason = "Plan for a running team driver in briefing, preparation or the race."; return result
	if c.route == "pit" or c.pit_order or c.scheduled_lap >= 0:
		result.reason = "An accepted pit transaction already exists. Keep it or cancel it through the ordinary pit controls."; return result
	var rival = sim.cars[int(plan.target_id)]
	if rival.dnf or rival.finished: result.reason = "This rival's contest has ended."; return result
	if sim.phase == "race" and plan.kind == "undercut" and plan.rival_first and rival.route == "pit":
		result.reason = "The rival is already in the pits; an undercut cannot be started against this entry."; return result
	var s = RaceForecaster.capture(sim, id, sim.active_plan(id), int(sim.policy(id).revision))
	if s.water > 0.15 or c.compound in ["I", "W"]:
		result.reason = "These are dry-race tactics. Use the weather comparison in crossover conditions."; return result
	var item = TyreInventory.find(c, plan.set_id)
	if not WheelTyres.usable(item) or item.id == s.own.starting_set or item.compound in ["I", "W"]:
		result.reason = "Select another usable dry set; a draft cannot refresh or reuse the fitted set."; return result
	var first_gate = maxf(s.gate.distance, (float(plan.from_lap) - 1) * s.length + s.pit_entry)
	var chosen_gate = maxf(first_gate, (float(plan.from_lap + plan.wait_laps) - 1) * s.length + s.pit_entry) if plan.kind == "extend" else first_gate
	var latest = (float(plan.to_lap) - 1) * s.length + s.pit_entry
	if chosen_gate > latest or chosen_gate >= s.laps * s.length:
		result.reason = "The promised window is no longer safely reachable. Review a new draft."; return result
	var following: Array = []
	var remaining = sim.active_plan(id).get("stops", [])
	for i in range(1, remaining.size()):
		var stop = remaining[i]
		if stop.from_lap <= plan.to_lap or stop.set_id == plan.set_id:
			result.reason = "This tactic would conflict with a later approved stint. Revise the ordinary plan first."; return result
		following.append({"at": (float(stop.from_lap) - 1) + s.pit_entry / s.length, "set_id": stop.set_id})
	var current = RaceForecaster.evaluate(s).options[0]
	var early = RaceForecaster.evaluate_candidate(s, "early", "Earlier stop", [{"at": first_gate / s.length, "set_id": item.id}] + following)
	var later_gate = minf(latest, first_gate + float(plan.wait_laps) * s.length)
	var later = RaceForecaster.evaluate_candidate(s, "later", "Extend then stop", [{"at": later_gate / s.length, "set_id": item.id}] + following)
	result.options = [current, early, later]
	result.candidate = RaceForecaster.evaluate_candidate(s, plan.kind, LABELS[plan.kind], [{"at": chosen_gate / s.length, "set_id": item.id}] + following)
	result.pit = RaceForecaster.pit_prediction(s, chosen_gate)
	result.gate = chosen_gate
	result.first_gate = first_gate
	result.latest_gate = latest
	for public in s.public:
		if public.id == int(plan.target_id): result.target = public.duplicate(true)
	result.gap = (rival.distance - c.distance) / maxf(1, s.length / s.reference_lap)
	for option in result.options + [result.candidate]:
		if option.available: option.gain = current.get("seconds", option.seconds) - option.seconds
	result.rival_cases = rival_cases(sim, s, plan, item, result.pit, result.target, result.gap)
	result.available = result.candidate.available
	if result.available and plan.authority == "execute" and result.candidate.risk == "high":
		result.available = false; result.reason = "The selected remaining-stint estimate is high risk. Revise the window/set or use recommendation only; this mandate does not authorize that exposure."
		return result
	if not result.available: result.reason = result.candidate.get("reason", "The selected tactic is unavailable.")
	result.assumptions = "Remaining-time estimates, not a winning prediction. Current modes and water held constant; rival pace is observed, future stops unknown. Warm-up and traffic remain coarse."
	return result

static func team_compare(sim: StrategyRaceSim) -> String:
	var sources: Array = [RaceForecaster.capture(sim, 3, sim.active_plan(3)), RaceForecaster.capture(sim, 6, sim.active_plan(6))]
	var forecasts: Array = sources.map(func(s): return RaceForecaster.evaluate(s))
	var baseline_total = 0.0
	var baseline_queue = 0.0
	var lines: Array[String] = ["TWO CARS · THREE COMPARISONS", "Observational only. Approve each driver's actual plan separately. These use the ordinary comparison's suggested replacement sets, not unapplied tactical drafts."]
	for pair in [["Keep both plans", "current", "current"], ["MER early / MOR extend", "box", "extend"], ["MOR early / MER extend", "extend", "box"]]:
		var total = 0.0; var base = 0.0; var available = true; var arrivals: Array = []
		for i in range(2):
			var matching = forecasts[i].options.filter(func(o): return o.id == pair[i + 1] and o.available)
			if matching.is_empty() or not forecasts[i].options[0].available: available = false; break
			var choice = matching[0]; var s = sources[i]
			total += choice.seconds; base += forecasts[i].options[0].seconds
			if not choice.stops.is_empty():
				var pit = RaceForecaster.pit_prediction(s, choice.stops[0].at * s.length)
				arrivals.append({"at": pit.entry_eta + s.own.box_d / s.pit_limit + 1.5, "service": 3.75 + (s.own.damage * 0.14 if s.own.repair else 0), "existing_queue": pit.queue})
		var extra_queue = 0.0
		if arrivals.size() == 2:
			arrivals.sort_custom(func(a, b): return a.at < b.at)
			extra_queue = maxf(0, arrivals[0].at + arrivals[0].service - arrivals[1].at - arrivals[1].existing_queue)
		if pair[1] == "current" and pair[2] == "current": baseline_total = base; baseline_queue = extra_queue
		lines.append(pair[0] + (": unavailable in the current phase or stock." if not available else ": estimated summed time change %+.1fs; additional shared-box exposure ~%.1fs." % [total + extra_queue - baseline_total - baseline_queue, extra_queue]))
	lines.append("Negative summed time is faster in this coarse model, not more team points or a promised classification. Arrival uncertainty, future rival responses and late window choices can change the result.")
	return "\n\n".join(lines)

static func rival_cases(sim: StrategyRaceSim, source: Dictionary, plan: Dictionary, item: Dictionary, pit: Dictionary, target: Dictionary, gap: float) -> String:
	if plan.kind == "extend":
		return "RIVAL RESPONSE CASES · not predicted intentions\nRival stops first: observe its new pace before spending more tyre life. Its fresh-set condition is unknown.\nRival also waits: track position is retained, but both tyres continue ageing. The agreed extension and resource limits still apply."
	if source.phase != "race" or target.is_empty() or target.route == "pit":
		return "RIVAL RESPONSE CASES · not predicted intentions\nThe rival may cover at its next safe entry or continue its stint. A prospective cycle margin needs live, comparable race timing; none is invented here."
	var observed = sim.cars[int(plan.target_id)].history.any(func(lap): return not lap.get("pit_lap", false) and lap.get("time", 0) > 0)
	if not observed or absf(target.distance - source.own.distance) >= source.length:
		return "RIVAL RESPONSE CASES · no comparable observed race-lap sample yet. Covering can shorten the useful fresh-tyre interval; waiting can lengthen it. No numerical cycle margin is shown."
	var advantage = target.lap_seconds - RaceForecaster.lap_time(source, item, item.life)
	var cost = pit.warmup + pit.queue + pit.traffic.size() * 0.8
	return "RIVAL RESPONSE CASES · conditional model, not a winning prediction\nCovers one lap later: estimated gap after an equal-stop cycle ~%+.1fs.\nWaits two laps: estimated gap ~%+.1fs. Positive means still behind.\nAssumes today's gap survives to our entry, observed rival pace continues, equal net stop loss and one stop each. Opponent warm-up, future traffic and unannounced plans are unknown." % [gap - advantage + cost, gap - advantage * 2 + cost]
