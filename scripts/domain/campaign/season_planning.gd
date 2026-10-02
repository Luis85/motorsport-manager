class_name CampaignSeasonPlanning
extends RefCounted
## Multi-season planning, future-car allocation and explicit promotion choices.
const MAX_PLANS = 64
const MAX_OFFERS = 64
const MAX_TRANSITIONS = 64
const SPORTING_AMBITIONS = ["finish", "points", "podium", "title"]
const ORGANIZATIONAL_AMBITIONS = ["cash_reserve", "driver_development", "next_platform", "reliability"]
const DECISIONS = ["stay", "promote"]

static func empty() -> Dictionary:
	return {"plans": {}, "promotion_offers": {}, "transitions": []}

static func set_plan(current: Dictionary, input: Dictionary, slot: int) -> Dictionary:
	var error = validate(current)
	if not error.is_empty(): return _reject(error, current)
	if current.plans.size() >= MAX_PLANS: return _reject("Season planning registry is full.", current)
	var plan = {"id": input.get("id"), "season_id": input.get("season_id"),
		"created_slot": slot, "sporting_ambition": input.get("sporting_ambition"),
		"organizational_ambition": input.get("organizational_ambition"),
		"current_car_bps": input.get("current_car_bps"),
		"next_car_bps": input.get("next_car_bps"),
		"future_car_focus": input.get("future_car_focus", "mechanical_grip"),
		"status": "active"}
	_seal(plan)
	if not _plan_error(plan).is_empty() or current.plans.has(plan.get("id")):
		return _reject("Season plan is invalid or duplicated.", current)
	var data = current.duplicate(true); data.plans[plan.id] = plan
	return _result(data, "plan_set", current)

static func offer_promotion(current: Dictionary, input: Dictionary, slot: int) -> Dictionary:
	var error = validate(current)
	if not error.is_empty(): return _reject(error, current)
	if current.promotion_offers.size() >= MAX_OFFERS:
		return _reject("Promotion offer registry is full.", current)
	var offer = {"id": input.get("id"), "source_season_id": input.get("source_season_id"),
		"target_series_id": input.get("target_series_id"), "created_slot": slot,
		"deadline_slot": input.get("deadline_slot"), "minimum_cash_minor": input.get("minimum_cash_minor"),
		"status": "offered", "resolved_slot": -1}
	_seal(offer)
	if not _offer_error(offer).is_empty() or current.promotion_offers.has(offer.get("id")):
		return _reject("Promotion offer is invalid or duplicated.", current)
	var data = current.duplicate(true); data.promotion_offers[offer.id] = offer
	return _result(data, "promotion_offered", current)

static func decide_promotion(current: Dictionary, offer_id: String, accept: bool,
		slot: int, current_cash_minor: int) -> Dictionary:
	var error = validate(current)
	if not error.is_empty(): return _reject(error, current)
	if not current.promotion_offers.has(offer_id):
		return _reject("Promotion offer is unknown.", current)
	var offer: Dictionary = current.promotion_offers[offer_id]
	if offer.status != "offered" or slot > int(offer.deadline_slot):
		return _reject("Promotion offer is no longer open.", current)
	if accept and current_cash_minor < int(offer.minimum_cash_minor):
		return _reject("Promotion funding requirement is not met.", current)
	var data = current.duplicate(true); offer = offer.duplicate(true)
	offer.status = "accepted" if accept else "declined"; offer.resolved_slot = slot
	_seal(offer); data.promotion_offers[offer_id] = offer
	return _result(data, offer.status, current)

static func record_transition(current: Dictionary, input: Dictionary, slot: int) -> Dictionary:
	var error = validate(current)
	if not error.is_empty(): return _reject(error, current)
	if current.transitions.size() >= MAX_TRANSITIONS:
		return _reject("Season transition history is full.", current)
	var record = {"id": input.get("id"), "source_season_id": input.get("source_season_id"),
		"next_season_id": input.get("next_season_id"), "target_series_id": input.get("target_series_id"),
		"decision": input.get("decision"), "slot": slot, "rules_digest": input.get("rules_digest")}
	_seal(record)
	if not _transition_error(record).is_empty():
		return _reject("Season transition evidence is invalid.", current)
	for prior in current.transitions:
		if prior.id == record.id or prior.source_season_id == record.source_season_id:
			return _reject("Source season already has a transition record.", current)
	var data = current.duplicate(true); data.transitions.append(record)
	if data.plans.has(record.source_season_id):
		var plan: Dictionary = data.plans[record.source_season_id].duplicate(true)
		plan.status = "completed"; _seal(plan); data.plans[record.source_season_id] = plan
	return _result(data, "transition_recorded", current)

static func validate(data: Variant) -> String:
	if not data is Dictionary or data.size() != 3 			or not data.get("plans") is Dictionary or data.plans.size() > MAX_PLANS 			or not data.get("promotion_offers") is Dictionary or data.promotion_offers.size() > MAX_OFFERS 			or not data.get("transitions") is Array or data.transitions.size() > MAX_TRANSITIONS:
		return "Campaign season-planning projection is invalid."
	for id in data.plans:
		if id != data.plans[id].get("id") or not _plan_error(data.plans[id]).is_empty():
			return "Campaign season plan registry is invalid."
	for id in data.promotion_offers:
		if id != data.promotion_offers[id].get("id") or not _offer_error(data.promotion_offers[id]).is_empty():
			return "Campaign promotion offer registry is invalid."
	var sources = {}
	for record in data.transitions:
		if not _transition_error(record).is_empty() or sources.has(record.source_season_id):
			return "Campaign season transition history is invalid."
		sources[record.source_season_id] = true
	return ""

static func _plan_error(data: Variant) -> String:
	if not data is Dictionary or data.size() != 10 or not CampaignIdentity.valid(data.get("id")) 			or not CampaignIdentity.valid(data.get("season_id")) or data.id != data.season_id 			or data.get("sporting_ambition") not in SPORTING_AMBITIONS 			or data.get("organizational_ambition") not in ORGANIZATIONAL_AMBITIONS 			or not RaceCheckpoint.integral(data.get("current_car_bps"), 0, 10000) 			or not RaceCheckpoint.integral(data.get("next_car_bps"), 0, 10000) 			or int(data.current_car_bps) + int(data.next_car_bps) != 10000 			or data.get("future_car_focus") not in CampaignEngineeringProject.DOMAINS 			or data.get("status") not in ["active", "completed"] 			or not RaceCheckpoint.integral(data.get("created_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS):
		return "invalid season plan"
	return _digest_error(data)

static func _offer_error(data: Variant) -> String:
	if not data is Dictionary or data.size() != 9:
		return "invalid promotion offer shape"
	for key in ["id", "source_season_id", "target_series_id"]:
		if not CampaignIdentity.valid(data.get(key)): return "invalid promotion identity"
	if not RaceCheckpoint.integral(data.get("created_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS) 			or not RaceCheckpoint.integral(data.get("deadline_slot"), int(data.created_slot), CampaignClock.MAX_ELAPSED_SLOTS) 			or not RaceCheckpoint.integral(data.get("minimum_cash_minor"), 0, CampaignEconomy.MAX_MINOR) 			or data.get("status") not in ["offered", "accepted", "declined"] 			or not RaceCheckpoint.integral(data.get("resolved_slot"), -1, CampaignClock.MAX_ELAPSED_SLOTS):
		return "invalid promotion terms"
	if data.status == "offered" and int(data.resolved_slot) != -1: return "open promotion is resolved"
	if data.status in ["accepted", "declined"] and (int(data.resolved_slot) < int(data.created_slot) 			or int(data.resolved_slot) > int(data.deadline_slot)): return "promotion resolution timing invalid"
	return _digest_error(data)

static func _transition_error(data: Variant) -> String:
	if not data is Dictionary or data.size() != 8: return "invalid transition shape"
	for key in ["id", "source_season_id", "next_season_id", "target_series_id"]:
		if not CampaignIdentity.valid(data.get(key)): return "invalid transition identity"
	if data.get("decision") not in DECISIONS or not RaceCheckpoint.integral(data.get("slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS) 			or not CampaignIdentity.valid_hash(data.get("rules_digest")):
		return "invalid transition evidence"
	return _digest_error(data)

static func _result(data: Dictionary, status: String, current: Dictionary) -> Dictionary:
	var error = validate(data)
	return {"ok": error.is_empty(), "status": status if error.is_empty() else "rejected",
		"error": error, "season_planning": data if error.is_empty() else current.duplicate(true)}

static func _reject(message: String, current: Dictionary) -> Dictionary:
	return {"ok": false, "status": "rejected", "error": message,
		"season_planning": current.duplicate(true)}

static func _digest_error(data: Dictionary) -> String:
	var content = data.duplicate(true); content.erase("digest")
	return "" if CampaignIdentity.valid_hash(data.get("digest")) 		and data.digest == RaceStateValue.fingerprint(content) else "invalid integrity digest"

static func _seal(data: Dictionary) -> void:
	data.erase("digest"); data["digest"] = RaceStateValue.fingerprint(data)
