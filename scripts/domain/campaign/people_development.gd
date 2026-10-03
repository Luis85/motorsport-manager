class_name CampaignPeopleDevelopment
extends RefCounted
## Persistent candidate market, role-relevant development, morale/trust and explicit promises.
const MAX_CANDIDATES = 256
const MAX_PROFILES = CampaignPersonnel.MAX_PEOPLE
const MAX_PLANS = CampaignPersonnel.MAX_PEOPLE
const MAX_PROMISES = 1024
const MAX_REVIEWS = 4096
const ATTRIBUTES = ["technical", "operations", "commercial", "feedback", "development"]
const PREFERENCES = [
	"stable_role", "development_support", "leadership", "competitive_team", "balanced_workload"
]
const PROMISE_TYPES = ["role", "development", "seat", "workload"]
const CANDIDATE_STATES = ["available", "approached", "negotiating", "signed", "withdrawn"]


static func empty() -> Dictionary:
	return {"candidates": {}, "profiles": {}, "plans": {}, "promises": {}, "reviews": []}


static func register_candidate(
	current: Dictionary, input: Dictionary, created_slot: int
) -> Dictionary:
	var error = validate(current)
	if not error.is_empty():
		return _reject(error, current)
	if current.candidates.size() >= MAX_CANDIDATES:
		return _reject("Candidate market is full.", current)
	var candidate = _candidate(input, created_slot)
	if candidate.is_empty() or current.candidates.has(candidate.get("id")):
		return _reject("Candidate is invalid or duplicated.", current)
	var data = current.duplicate(true)
	data.candidates[candidate.id] = candidate
	return _result(data, "candidate_registered", current)


static func approach(current: Dictionary, candidate_id: String, slot: int) -> Dictionary:
	var error = validate(current)
	if not error.is_empty():
		return _reject(error, current)
	if not current.candidates.has(candidate_id):
		return _reject("Candidate is unknown.", current)
	var candidate: Dictionary = current.candidates[candidate_id]
	if candidate.state != "available" or slot < int(candidate.available_slot):
		return _reject("Candidate is not available to approach.", current)
	var data = current.duplicate(true)
	candidate = candidate.duplicate(true)
	candidate.state = "approached"
	candidate.last_contact_slot = slot
	_seal(candidate)
	data.candidates[candidate_id] = candidate
	return _result(data, "approached", current)


static func evaluate_offer(
	current: Dictionary,
	candidate_id: String,
	role_id: String,
	pay_minor: int,
	start_slot: int,
	slot: int,
	policy: Dictionary = {}
) -> Dictionary:
	var error = validate(current)
	var tuning = CampaignPeoplePolicy.normalized(policy)
	if not error.is_empty():
		return _reject(error, current)
	if not current.candidates.has(candidate_id):
		return _reject("Candidate is unknown.", current)
	var candidate: Dictionary = current.candidates[candidate_id]
	if candidate.state not in ["approached", "negotiating"] or candidate.offer_count >= 3:
		return _reject("Candidate is not in an active bounded negotiation.", current)
	if (
		role_id not in candidate.eligible_roles
		or start_slot < maxi(slot, int(candidate.available_slot))
		or not RaceCheckpoint.integral(pay_minor, 1, CampaignEconomy.MAX_MINOR)
	):
		return _reject("Offer role, start date or pay is invalid.", current)
	var data = current.duplicate(true)
	candidate = candidate.duplicate(true)
	candidate.offer_count = int(candidate.offer_count) + 1
	candidate.last_offer_minor = pay_minor
	candidate.last_contact_slot = slot
	var ratio = float(pay_minor) / float(candidate.salary_expectation_minor)
	var accepted = ratio >= 1.0
	if accepted:
		candidate.state = "signed"
	elif ratio * 10000.0 >= float(tuning.counter_offer_ratio_bps) and candidate.offer_count < 3:
		candidate.state = "negotiating"
	else:
		candidate.state = "withdrawn"
	_seal(candidate)
	data.candidates[candidate_id] = candidate
	var result = _result(
		data,
		(
			"accepted"
			if accepted
			else ("countered" if candidate.state == "negotiating" else "rejected")
		),
		current
	)
	if result.ok:
		result["accepted"] = accepted
		result["candidate"] = candidate.duplicate(true)
		result["reason"] = (
			"Role is suitable and guaranteed pay meets expectations."
			if accepted
			else (
				"Role is suitable; guaranteed pay remains below expectations."
				if candidate.state == "negotiating"
				else "Candidate withdrew after the bounded negotiation did not meet expectations."
			)
		)
	return result


static func add_profile(
	current: Dictionary,
	person_id: String,
	attributes: Dictionary,
	slot: int,
	morale: int = 60,
	trust: int = 60
) -> Dictionary:
	var error = validate(current)
	if not error.is_empty():
		return _reject(error, current)
	if current.profiles.has(person_id) or not CampaignIdentity.valid(person_id):
		return _reject("People profile is invalid or duplicated.", current)
	var profile = _profile(person_id, attributes, slot, morale, trust)
	if profile.is_empty():
		return _reject("People profile attributes are invalid.", current)
	var data = current.duplicate(true)
	data.profiles[person_id] = profile
	return _result(data, "profile_added", current)


static func set_plan(
	current: Dictionary, person_id: String, focus: String, review_slot: int, slot: int
) -> Dictionary:
	var error = validate(current)
	if not error.is_empty():
		return _reject(error, current)
	if (
		not current.profiles.has(person_id)
		or focus not in ATTRIBUTES
		or not RaceCheckpoint.integral(
			review_slot, slot + CampaignClock.SLOTS_PER_DAY, CampaignClock.MAX_ELAPSED_SLOTS
		)
	):
		return _reject(
			"Development plan requires a profiled person, role-relevant focus and future review.",
			current
		)
	var data = current.duplicate(true)
	var plan = {
		"person_id": person_id,
		"focus": focus,
		"created_slot": slot,
		"last_review_slot": slot,
		"review_slot": review_slot,
		"status": "active"
	}
	plan["digest"] = RaceStateValue.fingerprint(plan)
	data.plans[person_id] = plan
	return _result(data, "plan_set", current)


static func create_promise(current: Dictionary, input: Dictionary, slot: int) -> Dictionary:
	var error = validate(current)
	if not error.is_empty():
		return _reject(error, current)
	if current.promises.size() >= MAX_PROMISES:
		return _reject("Promise registry is full.", current)
	var promise = {
		"id": input.get("id"),
		"person_id": input.get("person_id"),
		"type": input.get("type"),
		"created_slot": slot,
		"deadline_slot": input.get("deadline_slot"),
		"evidence_id": input.get("evidence_id"),
		"status": "open",
		"resolved_slot": -1
	}
	promise["digest"] = RaceStateValue.fingerprint(promise)
	if (
		not CampaignPeopleDevelopmentValidation._promise_error(promise).is_empty()
		or current.promises.has(promise.get("id"))
		or not current.profiles.has(promise.get("person_id"))
	):
		return _reject("Promise is invalid, duplicated or references an unknown profile.", current)
	var data = current.duplicate(true)
	data.promises[promise.id] = promise
	return _result(data, "promise_created", current)


static func resolve_promise(
	current: Dictionary, promise_id: String, fulfilled: bool, slot: int
) -> Dictionary:
	var error = validate(current)
	if not error.is_empty():
		return _reject(error, current)
	if not current.promises.has(promise_id) or current.promises[promise_id].status != "open":
		return _reject("Promise is unknown or already resolved.", current)
	var data = current.duplicate(true)
	var promise: Dictionary = data.promises[promise_id]
	if fulfilled and slot > int(promise.deadline_slot):
		return _reject("Expired promise cannot be fulfilled retroactively.", current)
	if not fulfilled and slot < int(promise.deadline_slot):
		return _reject("Open promise cannot fail before its declared deadline.", current)
	promise.status = "fulfilled" if fulfilled else "failed"
	promise.resolved_slot = slot
	_seal(promise)
	data.promises[promise_id] = promise
	var profile: Dictionary = data.profiles[promise.person_id]
	profile.trust = clampi(int(profile.trust) + (5 if fulfilled else -8), 0, 100)
	profile.last_change_slot = slot
	_seal(profile)
	data.profiles[promise.person_id] = profile
	return _result(data, promise.status, current)


static func review_due(
	current: Dictionary, personnel: Dictionary, slot: int, policy: Dictionary = {}
) -> Dictionary:
	var error = validate(current)
	var tuning = CampaignPeoplePolicy.normalized(policy)
	if not error.is_empty():
		return _reject(error, current)
	error = CampaignPersonnel.validate(personnel)
	if not error.is_empty():
		return _reject(error, current)
	var data = current.duplicate(true)
	var reviewed = 0
	var ids = data.plans.keys()
	ids.sort()
	for person_id in ids:
		var plan: Dictionary = data.plans[person_id]
		if plan.status != "active" or slot < int(plan.review_slot):
			continue
		if not personnel.people.has(person_id):
			continue
		var profile: Dictionary = data.profiles[person_id]
		var load = _workload(personnel, person_id, int(plan.last_review_slot), slot)
		var load_bps = int(round(load * 10000.0))
		var gain = (
			int(tuning.productive_gain)
			if (
				load_bps >= int(tuning.productive_load_min_bps)
				and load_bps <= int(tuning.productive_load_max_bps)
			)
			else int(tuning.other_gain)
		)
		profile.attributes[plan.focus] = mini(100, int(profile.attributes[plan.focus]) + gain)
		var morale_delta = (
			int(tuning.morale_safe_delta)
			if load_bps <= int(tuning.morale_safe_load_bps)
			else int(tuning.morale_overload_delta)
		)
		profile.morale = clampi(int(profile.morale) + morale_delta, 0, 100)
		profile.last_change_slot = slot
		_seal(profile)
		data.profiles[person_id] = profile
		var interval = maxi(
			CampaignClock.SLOTS_PER_DAY, int(plan.review_slot) - int(plan.last_review_slot)
		)
		plan.last_review_slot = slot
		plan.review_slot = mini(CampaignClock.MAX_ELAPSED_SLOTS, slot + interval)
		_seal(plan)
		data.plans[person_id] = plan
		var review = {
			"person_id": person_id,
			"slot": slot,
			"focus": plan.focus,
			"gain": gain,
			"workload": snappedf(load, 0.001),
			"morale": int(profile.morale),
			"trust": int(profile.trust)
		}
		review["digest"] = RaceStateValue.fingerprint(review)
		data.reviews.append(review)
		reviewed += 1
		if data.reviews.size() > MAX_REVIEWS:
			return _reject("People review history is full.", current)
	return {
		"ok": validate(data).is_empty(),
		"status": "reviewed" if reviewed > 0 else "no_change",
		"error": validate(data),
		"people": data if validate(data).is_empty() else current.duplicate(true),
		"reviewed": reviewed
	}


static func validate(data: Variant) -> String:
	return CampaignPeopleDevelopmentValidation.validate(data)


static func _candidate(input: Dictionary, created_slot: int) -> Dictionary:
	var data = {
		"id": input.get("id"),
		"display_name": input.get("display_name"),
		"eligible_roles": input.get("eligible_roles", []).duplicate(true),
		"attributes": input.get("attributes", {}).duplicate(true),
		"confidence": input.get("confidence", 50),
		"salary_expectation_minor": input.get("salary_expectation_minor"),
		"available_slot": input.get("available_slot", created_slot),
		"preferences": input.get("preferences", []).duplicate(true),
		"created_slot": created_slot,
		"state": "available",
		"offer_count": 0,
		"last_offer_minor": 0,
		"last_contact_slot": -1
	}
	_seal(data)
	return data if CampaignPeopleDevelopmentValidation._candidate_error(data).is_empty() else {}


static func _profile(
	person_id: String, attributes: Dictionary, slot: int, morale: int, trust: int
) -> Dictionary:
	var data = {
		"person_id": person_id,
		"attributes": attributes.duplicate(true),
		"morale": morale,
		"trust": trust,
		"created_slot": slot,
		"last_change_slot": slot
	}
	_seal(data)
	return data if CampaignPeopleDevelopmentValidation._profile_error(data).is_empty() else {}


static func _workload(
	personnel: Dictionary, person_id: String, start_slot: int, end_slot: int
) -> float:
	var duration = maxi(1, end_slot - start_slot)
	var occupied = 0
	for reservation in personnel.reservations.values():
		if reservation.status != "active" or reservation.person_id != person_id:
			continue
		var start = maxi(start_slot, int(reservation.start_slot))
		var finish = mini(end_slot, int(reservation.end_slot))
		if finish > start:
			occupied += finish - start
	return clampf(float(occupied) / float(duration), 0.0, 1.0)


static func _result(data: Dictionary, status: String, current: Dictionary) -> Dictionary:
	var error = validate(data)
	return {
		"ok": error.is_empty(),
		"status": status if error.is_empty() else "rejected",
		"error": error,
		"people": data if error.is_empty() else current.duplicate(true)
	}


static func _reject(message: String, current: Dictionary) -> Dictionary:
	return {"ok": false, "status": "rejected", "error": message, "people": current.duplicate(true)}


static func _seal(data: Dictionary) -> void:
	data.erase("digest")
	data["digest"] = RaceStateValue.fingerprint(data)
