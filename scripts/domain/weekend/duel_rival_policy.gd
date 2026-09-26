class_name DuelRivalPolicy
extends RefCounted
## New-model refinement only. Uses own estimates, observed stops and own-team orders.
## Selects among RivalStyles' already legal, near-best candidates; adds no pace bonus.
static func decide(source: Dictionary, stops: Array, driver: Dictionary, comparison: Dictionary) -> Dictionary:
	var result = RivalStyles.decide(source, stops, driver, comparison)
	if result.is_empty(): return result
	var candidates = result.candidates
	var box = candidates.filter(func(c): return c.id == "box")
	var extend = candidates.filter(func(c): return c.id == "extend")
	var current = candidates.filter(func(c): return c.id == "current")
	var choice = result.choice
	var reason = result.reason
	if not result.context.public_event.is_empty() and result.context.cover > 0 and not box.is_empty():
		var viable_cover = result.context.fresh_lap_gain > comparison.pit.warmup + result.context.traffic_cost
		if viable_cover and comparison.pit.queue <= 1.0 and box[0].score <= 2.0:
			choice = "box"
			reason = "Cover a credible observed entry: fresh-tyre opportunity exceeds modeled warm-up/traffic cost within the near-best alternatives."
		elif not extend.is_empty():
			choice = "extend"
			reason = "Decline to cover the observed entry: warm-up, rejoin or shared service weakens the opportunity; extend usable tyres, then review."
	# Own teammate's accepted stop is legitimate information, never a rival draft.
	if choice == "box" and comparison.pit.queue > 1.0 and (not extend.is_empty() or not current.is_empty()):
		choice = "extend" if not extend.is_empty() else "current"
		reason = "Split the team's response: a teammate already has accepted pit access; choose a feasible near-best alternative rather than add predicted queueing."
	result.choice = choice; result.reason = reason
	result.set_id = RaceForecaster.replacement(source).get("id", "") if choice == "box" else ""
	result.hold_gate = -1.0
	if choice == "extend":
		var selected = comparison.options.filter(func(o): return o.id == "extend" and o.available)
		if selected.is_empty() or selected[0].stops.is_empty(): return {}
		result.hold_gate = maxf(source.gate.distance, selected[0].stops[0].at * source.length - source.length)
	return result
