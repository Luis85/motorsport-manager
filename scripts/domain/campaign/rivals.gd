class_name CampaignRivals
extends RefCounted
## Bounded rival organizations for the first campaign slice. Rivals have finite
## cash, explicit commitments, accepted rosters and dated project reviews.
const MAX_TEAMS = CampaignSeriesRules.MAX_ENTRANTS - 1
const MAX_CYCLES = 2048
const ARCHETYPES = ["constructor", "customer", "talent", "innovator", "reliability", "commercial", "independent"]
const PROJECTS = ["reliability", "balanced_development", "driver_development", "cash_preservation"]
const MAX_CAPABILITY_BPS = 20000

static func empty() -> Dictionary:
	return {"teams": {}, "decision_cycles": []}

static func register_team(current: Dictionary, input: Dictionary, created_slot: int) -> Dictionary:
	var error = validate(current)
	if not error.is_empty(): return _reject(error, current)
	if current.teams.size() >= MAX_TEAMS:
		return _reject("Campaign rival registry is full.", current)
	var team = _build_team(input, created_slot)
	if team.is_empty() or current.teams.has(team.get("team_id")):
		return _reject("Campaign rival team is invalid or duplicated.", current)
	var data = current.duplicate(true)
	data.teams[team.team_id] = team
	return {"ok": true, "status": "registered", "error": "", "rivals": data}

static func review_due(current: Dictionary, slot: int, public_context: Dictionary = {}) -> Dictionary:
	var error = validate(current)
	if not error.is_empty(): return _reject(error, current)
	if not RaceCheckpoint.integral(slot, 0, CampaignClock.MAX_ELAPSED_SLOTS):
		return _reject("Campaign rival review has invalid time.", current)
	var data = current.duplicate(true)
	var reviewed = 0
	var ids = data.teams.keys(); ids.sort()
	for team_id in ids:
		var team: Dictionary = data.teams[team_id]
		if slot < int(team.next_review_slot): continue
		team = _settle_previous(team)
		var plan = _choose_plan(team, public_context)
		var spend = _project_spend(team, plan)
		team.project = plan
		team.committed_minor = spend
		team.last_review_slot = slot
		team.next_review_slot = mini(CampaignClock.MAX_ELAPSED_SLOTS, slot + int(team.review_interval_slots))
		_seal_team(team)
		data.teams[team_id] = team
		var cycle = {
			"id": "rivalcycle." + RaceStateValue.fingerprint([team_id, slot]).substr(0, 24),
			"team_id": team_id, "slot": slot, "project": plan,
			"committed_minor": spend,
			"information_scope": "own organization + public championship standings",
			"public_context_digest": RaceStateValue.fingerprint(public_context)
		}
		cycle["digest"] = RaceStateValue.fingerprint(cycle)
		data.decision_cycles.append(cycle)
		reviewed += 1
		if data.decision_cycles.size() > MAX_CYCLES:
			return _reject("Campaign rival decision history is full.", current)
	error = validate(data)
	return {"ok": error.is_empty(), "status": "reviewed" if reviewed > 0 else "no_change",
		"error": error, "rivals": data if error.is_empty() else current.duplicate(true), "reviewed": reviewed}

static func validate(data: Variant) -> String:
	if not data is Dictionary or data.size() != 2 or not data.get("teams") is Dictionary 			or data.teams.size() > MAX_TEAMS or not data.get("decision_cycles") is Array 			or data.decision_cycles.size() > MAX_CYCLES:
		return "Campaign rival projection is invalid."
	for team_id in data.teams:
		if team_id != data.teams[team_id].get("team_id"):
			return "Campaign rival key disagrees with its team identity."
		var error = _team_error(data.teams[team_id])
		if not error.is_empty(): return error
	var ids = {}
	for cycle in data.decision_cycles:
		var error = _cycle_error(cycle)
		if not error.is_empty() or ids.has(cycle.get("id")) or not data.teams.has(cycle.get("team_id")):
			return "Campaign rival decision history is invalid."
		ids[cycle.id] = true
	return ""

static func _build_team(input: Dictionary, created_slot: int) -> Dictionary:
	var data = {
		"team_id": input.get("team_id"), "entrant_id": input.get("entrant_id"),
		"person_ids": input.get("person_ids", []).duplicate(true),
		"car_ids": input.get("car_ids", []).duplicate(true),
		"archetype": input.get("archetype", "independent"),
		"created_slot": created_slot, "cash_minor": input.get("cash_minor"),
		"reserve_minor": input.get("reserve_minor"), "committed_minor": 0,
		"capability_bps": input.get("capability_bps", 10000),
		"project": "cash_preservation", "last_review_slot": created_slot,
		"next_review_slot": input.get("next_review_slot", created_slot),
		"review_interval_slots": input.get("review_interval_slots", CampaignClock.SLOTS_PER_DAY * 7),
		"policy": input.get("policy", {}).duplicate(true)
	}
	_seal_team(data)
	return data if _team_error(data).is_empty() else {}

static func _team_error(data: Variant) -> String:
	if not data is Dictionary or data.size() != 16:
		return "Campaign rival team has an unsupported shape."
	if not CampaignRivalPolicy.valid(data.get("policy")):
		return "Campaign rival team has an invalid planning policy."
	for key in ["team_id", "entrant_id"]:
		if not CampaignIdentity.valid(data.get(key)): return "Campaign rival team has an invalid " + key + "."
	if data.get("archetype") not in ARCHETYPES or data.get("project") not in PROJECTS:
		return "Campaign rival team has an invalid strategy."
	for key in ["person_ids", "car_ids"]:
		if not data.get(key) is Array or data[key].is_empty() or data[key].size() > CampaignSeriesRules.MAX_CARS_PER_ENTRANT:
			return "Campaign rival roster is invalid."
		var seen = {}
		for identity in data[key]:
			if not CampaignIdentity.valid(identity) or seen.has(identity):
				return "Campaign rival roster contains an invalid or repeated identity."
			seen[identity] = true
	if data.person_ids.size() != data.car_ids.size():
		return "Campaign rival people and car rosters differ in size."
	if not RaceCheckpoint.integral(data.get("created_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS) 			or not RaceCheckpoint.integral(data.get("last_review_slot"), int(data.created_slot), CampaignClock.MAX_ELAPSED_SLOTS) 			or not RaceCheckpoint.integral(data.get("next_review_slot"), int(data.last_review_slot), CampaignClock.MAX_ELAPSED_SLOTS) 			or not RaceCheckpoint.integral(data.get("review_interval_slots"), 1, CampaignClock.SLOTS_PER_DAY * 366):
		return "Campaign rival review timing is invalid."
	for key in ["cash_minor", "reserve_minor", "committed_minor"]:
		if not RaceCheckpoint.integral(data.get(key), 0, CampaignEconomy.MAX_MINOR):
			return "Campaign rival finance is invalid."
	if int(data.reserve_minor) > int(data.cash_minor) or int(data.committed_minor) > int(data.cash_minor) - int(data.reserve_minor):
		return "Campaign rival commitments exceed available cash after reserve."
	if not RaceCheckpoint.integral(data.get("capability_bps"), 5000, MAX_CAPABILITY_BPS):
		return "Campaign rival capability is invalid."
	return _record_digest_error(data)

static func _cycle_error(data: Variant) -> String:
	if not data is Dictionary or data.size() != 8:
		return "invalid cycle shape"
	for key in ["id", "team_id"]:
		if not CampaignIdentity.valid(data.get(key)): return "invalid cycle identity"
	if not RaceCheckpoint.integral(data.get("slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS) 			or data.get("project") not in PROJECTS 			or not RaceCheckpoint.integral(data.get("committed_minor"), 0, CampaignEconomy.MAX_MINOR) 			or data.get("information_scope") != "own organization + public championship standings" 			or not CampaignIdentity.valid_hash(data.get("public_context_digest")):
		return "invalid cycle evidence"
	return _record_digest_error(data)

static func _settle_previous(team: Dictionary) -> Dictionary:
	var result = team.duplicate(true)
	var policy = _policy(result)
	var spend = int(result.committed_minor)
	if spend > 0:
		result.cash_minor = maxi(0, int(result.cash_minor) - spend)
		var gain = mini(int(policy.max_gain_bps), int(round(float(spend) / float(policy.gain_minor_per_bps))))
		if result.project == "reliability":
			gain = int(round(float(gain) * float(policy.reliability_gain_bps) / 10000.0))
		elif result.project == "driver_development":
			gain = int(round(float(gain) * float(policy.driver_development_gain_bps) / 10000.0))
		result.capability_bps = mini(MAX_CAPABILITY_BPS, int(result.capability_bps) + gain)
	result.committed_minor = 0
	return result

static func _choose_plan(team: Dictionary, public_context: Dictionary) -> String:
	var policy = _policy(team)
	var rank = int(public_context.get("team_positions", {}).get(team.team_id, 99))
	if int(team.cash_minor) - int(team.reserve_minor) < int(policy.cash_preservation_threshold_minor):
		return "cash_preservation"
	if team.archetype == "reliability": return "reliability"
	if team.archetype == "talent": return "driver_development"
	if team.archetype in ["constructor", "innovator"]: return "balanced_development"
	if rank <= int(policy.leading_rank_threshold) and team.archetype in ["customer", "independent"]:
		return "cash_preservation"
	return "balanced_development"

static func _project_spend(team: Dictionary, plan: String) -> int:
	if plan == "cash_preservation": return 0
	var policy = _policy(team)
	var available = maxi(0, int(team.cash_minor) - int(team.reserve_minor))
	return mini(available, int(policy.plan_spend_minor.get(plan, 0)))

static func _policy(team: Dictionary) -> Dictionary:
	return team.policy

static func _record_digest_error(data: Dictionary) -> String:
	var content = data.duplicate(true); content.erase("digest")
	if not CampaignIdentity.valid_hash(data.get("digest")) 			or data.digest != RaceStateValue.fingerprint(content): return "Campaign rival integrity check failed."
	return ""

static func _seal_team(data: Dictionary) -> void:
	data.erase("digest"); data["digest"] = RaceStateValue.fingerprint(data)

static func _reject(message: String, current: Dictionary) -> Dictionary:
	return {"ok": false, "status": "rejected", "error": message, "rivals": current.duplicate(true)}
