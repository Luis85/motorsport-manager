class_name WeekendRaceControl
extends RefCounted
## Fictional virtual neutralization: reference-envelope pace cap, no catch-up or physical SC.
## Incidents are queued during movement and published once, BEFORE the next field snapshot.
const VERSION = 1
const PACE_FACTOR = 0.60
const ENDING_SECONDS = 8.0
const MAX_PENDING = 24

static func create() -> Dictionary:
	return {"version": VERSION, "state": "green", "until": 0.0, "revision": 0, "serial": 0,
		"zones": [], "pending": [], "reason": "Track clear", "sources": []}

static func enqueue(state: Dictionary, driver: int, sector: int, global: bool, duration: float, now: float, source: String, reason: String) -> void:
	# At most two hazards per car per authoritative step; repeated sources are idempotent.
	for item in state.pending:
		if item.source == source: return
	if state.pending.size() >= MAX_PENDING: return
	state.serial += 1
	state.pending.append({"serial": state.serial, "driver_id": driver, "sector": sector, "global": global,
		"duration": duration, "requested": now, "source": source, "reason": reason})

static func tick(state: Dictionary, now: float) -> Dictionary:
	var before = {"state": state.state, "until": state.until, "zones": state.zones.duplicate(true)}
	var causes: Array = []
	state.zones = state.zones.filter(func(zone): return zone.until > now)
	state.pending.sort_custom(func(a, b): return a.driver_id < b.driver_id if a.driver_id != b.driver_id else a.serial < b.serial)
	for request in state.pending:
		causes.append(request.source)
		state.reason = request.reason
		if request.global:
			state.state = "virtual"; state.until = maxf(state.until, now + request.duration)
		else:
			var found = false
			for zone in state.zones:
				if zone.sector == request.sector:
					zone.until = maxf(zone.until, now + request.duration); found = true; break
			if not found: state.zones.append({"sector": int(request.sector), "until": now + request.duration})
	state.pending.clear()
	state.zones.sort_custom(func(a, b): return a.sector < b.sector)
	if state.state == "virtual" and now + 0.0000001 >= state.until:
		state.state = "ending"; state.until = now + ENDING_SECONDS
		state.reason = "Clearance interval complete; no passing until the published release."
	elif state.state == "ending" and now + 0.0000001 >= state.until:
		state.state = "green"; state.until = 0.0; state.reason = "Virtual restriction released; any local yellows still apply."
	var after = {"state": state.state, "until": state.until, "zones": state.zones.duplicate(true)}
	if before == after: return {}
	state.revision += 1; state.sources = causes
	return {"before": before, "after": after, "sources": causes, "reason": state.reason,
		"effective_time": now, "rule_version": VERSION}

static func flag_value(state: Dictionary) -> String:
	if state.state == "virtual": return "VIRTUAL"
	if state.state == "ending": return "RESTART"
	return "YELLOW" if not state.zones.is_empty() else "GREEN"

static func restricted(state: Dictionary, length: float, start: float, end: float) -> bool:
	if state.state in ["virtual", "ending"]: return true
	# Intersect actual swept longitudinal distance, including a boundary or start-line wrap.
	for zone in state.zones:
		var lo = float(zone.sector) * length / 3.0
		var hi = float(zone.sector + 1) * length / 3.0
		var cycle = floor(start / length)
		for offset in [0, 1]:
			if end >= (cycle + offset) * length + lo and start < (cycle + offset) * length + hi: return true
	return false

static func public_view(state: Dictionary, now: float) -> Dictionary:
	var zones: Array = []
	for zone in state.zones: zones.append({"sector": int(zone.sector), "remaining": maxf(0, zone.until - now)})
	return {"state": state.state, "revision": state.revision, "flag": flag_value(state), "zones": zones,
		"remaining": maxf(0, state.until - now), "reason": state.reason,
		"pace_factor": PACE_FACTOR if state.state != "green" else 1.0,
		"rules": "Virtual: target at most 60% of the reference speed envelope; slower cars remain slower. No overtaking, catch-up or field reset. Brake normally on deployment. Pit entry, queues and release remain physical. Ending lasts eight simulated seconds; a new global hazard cancels it. Local yellow: 25 m/s target and no passing in the marked sector."}

static func valid(state: Variant, now: float) -> bool:
	if not state is Dictionary or state.get("version") != VERSION or state.get("state") not in ["green", "virtual", "ending"]: return false
	if not RaceCheckpoint.number(state.get("until"), 0, now + 120): return false
	if state.state == "green" and state.until != 0: return false
	for key in ["revision", "serial"]:
		if not RaceCheckpoint.integral(state.get(key), 0, 1000000): return false
	if not state.get("reason") is String or state.reason.length() > 512: return false
	if not state.get("sources") is Array or state.sources.size() > MAX_PENDING: return false
	for source in state.sources:
		if not source is String or source.length() > 64: return false
	if not state.get("zones") is Array or state.zones.size() > 3: return false
	var seen: Array = []
	for zone in state.zones:
		if not zone is Dictionary or not RaceCheckpoint.integral(zone.get("sector"), 0, 2) or zone.sector in seen: return false
		if not RaceCheckpoint.number(zone.get("until"), 0, now + 120): return false
		seen.append(zone.sector)
	if not state.get("pending") is Array or state.pending.size() > MAX_PENDING: return false
	var serials: Array = []; var sources: Array = []
	for item in state.pending:
		if not item is Dictionary or not RaceCheckpoint.integral(item.get("driver_id"), 0, 11) or not RaceCheckpoint.integral(item.get("sector"), 0, 2): return false
		if not RaceCheckpoint.integral(item.get("serial"), 1, state.serial) or item.serial in serials: return false
		if not RaceCheckpoint.number(item.get("duration"), 1, 120) or not RaceCheckpoint.number(item.get("requested"), 0, now): return false
		if not item.get("global") is bool: return false
		for key in ["source", "reason"]:
			if not item.get(key) is String or item[key].length() > 512: return false
		if item.source in sources: return false
		serials.append(item.serial); sources.append(item.source)
	return true
