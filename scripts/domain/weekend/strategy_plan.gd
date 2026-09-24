class_name StrategyPlan
extends RefCounted
## Small, finite strategy records. Windows authorize discretion, never teleport a car.
const CHANNELS = ["pace", "engine", "pit", "racecraft", "qualifying"]
const OBJECTIVES = ["balanced", "protect_finish", "chase_position"]

static func policy(car: Dictionary) -> Dictionary:
	var owners = {}
	for channel in CHANNELS: owners[channel] = "engineer" if car.auto else "player"
	return {"driver_id": int(car.id), "owners": owners, "overrides": {}, "revision": 0,
		"plan": {}, "next_stop": 0, "plan_status": "unplanned", "next_review": 0.0,
		"last_order_id": "", "plan_intent_id": "", "order_forecast": {}, "visit": {}, "held": {}, "notices": {}, "blocked_reason": ""}

static func draft(car: Dictionary, laps: int, template: String = "balanced") -> Dictionary:
	var starting = TyreInventory.planned(car)
	if starting.is_empty(): starting = TyreInventory.find(car, car.set_id)
	var stops: Array = []
	if template != "no_stop" and laps >= 4:
		var replacement = TyreInventory.choose(car, "H" if template == "balanced" else "M", true)
		if not replacement.is_empty() and replacement.id != starting.id:
			var middle = clampi(roundi(laps * (0.46 if template == "balanced" else 0.62)), 2, laps - 1)
			stops.append({"from_lap": middle, "to_lap": mini(laps - 1, middle + 1), "set_id": replacement.id})
	return {"version": 1, "driver_id": int(car.id), "objective": "balanced", "starting_set": starting.id,
		"stops": stops, "branches": ["avoid_traffic"], "tyre_reserve": 22.0, "fuel_reserve": 0.35, "allow_emergency": true}

static func validate(plan: Variant, car: Dictionary, laps: int, current_lap: int = 0, live: bool = true) -> String:
	if not plan is Dictionary: return "A strategy must be a record."
	if plan.get("version") != 1 or plan.get("driver_id") != car.id: return "Strategy version or driver does not match."
	if plan.get("objective") not in OBJECTIVES: return "Choose a supported strategy objective."
	if not plan.get("starting_set") is String: return "Select a starting set."
	var starting = TyreInventory.find(car, plan.starting_set)
	if starting.is_empty() or live and current_lap == 0 and not WheelTyres.usable(starting): return "Starting set is unavailable."
	if not plan.get("stops") is Array or plan.stops.size() > 3: return "Use at most three stop windows."
	if not plan.get("branches") is Array or plan.branches.size() > 1: return "Use at most one clear-air contingency."
	for branch in plan.branches:
		if branch != "avoid_traffic": return "Unsupported strategy contingency."
	if not RaceCheckpoint.number(plan.get("tyre_reserve"), 5, 50) or not RaceCheckpoint.number(plan.get("fuel_reserve"), 0, 3): return "Resource targets are outside their supported ranges."
	if not plan.get("allow_emergency") is bool: return "Declare whether the engineer may recover from a damaged tyre."
	var last = current_lap - 1
	var used = [plan.starting_set]
	for stop in plan.stops:
		if not stop is Dictionary: return "Invalid stop window."
		if not RaceCheckpoint.integral(stop.get("from_lap"), 1, laps - 1) or not RaceCheckpoint.integral(stop.get("to_lap"), 1, laps - 1): return "Stop windows must be before the final lap."
		if stop.from_lap <= last or stop.to_lap < stop.from_lap: return "Stop windows must be future, ordered and non-overlapping."
		if not stop.get("set_id") is String or stop.set_id in used: return "Each stint needs a distinct driver-owned set."
		var item = TyreInventory.find(car, stop.set_id)
		if item.is_empty() or live and (not WheelTyres.usable(item) or current_lap > 0 and item.id == car.set_id): return "A planned replacement set is unavailable."
		used.append(stop.set_id); last = int(stop.to_lap)
	return ""

static func owns(policy_record: Dictionary, channel: String) -> bool:
	return policy_record.owners.get(channel) == "engineer" and not policy_record.overrides.has(channel)

static func ownership_text(policy_record: Dictionary) -> String:
	var parts: Array[String] = []
	for channel in ["pace", "engine", "pit"]:
		parts.append(channel.capitalize() + ": " + ("temporary" if policy_record.overrides.has(channel) else policy_record.owners[channel]))
	return " · ".join(parts)
