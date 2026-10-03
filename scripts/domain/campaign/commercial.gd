class_name CampaignCommercial
extends RefCounted
## Sponsor agreements are contractual obligations, not a passive cash multiplier.
const MAX_AGREEMENTS = 128
const MAX_PAYMENTS = 16
const MAX_APPEARANCES = 16
const MAX_BONUSES = 16
const MAX_NAME = 120


static func empty() -> Dictionary:
	return {"agreements": {}, "bonus_claims": {}}


static func sign(current: Dictionary, input: Dictionary, signed_slot: int) -> Dictionary:
	var error = validate(current)
	if not error.is_empty():
		return _reject(error, current)
	if current.agreements.size() >= MAX_AGREEMENTS:
		return _reject("Sponsor agreement registry is full.", current)
	var agreement = _build(input, signed_slot)
	if agreement.is_empty() or current.agreements.has(agreement.get("id")):
		return _reject("Sponsor agreement is invalid or duplicated.", current)
	var data = current.duplicate(true)
	data.agreements[agreement.id] = agreement
	return {
		"ok": true,
		"status": "signed",
		"error": "",
		"commercial": data,
		"agreement": agreement.duplicate(true)
	}


static func claim_event_bonus(
	current: Dictionary,
	agreement_id: String,
	event_id: String,
	competition: Dictionary,
	claim_slot: int
) -> Dictionary:
	var error = validate(current)
	if not error.is_empty():
		return _reject(error, current)
	if not current.agreements.has(agreement_id) or not competition.events.has(event_id):
		return _reject(
			"Sponsor bonus requires an active agreement and settled campaign event.", current
		)
	var agreement: Dictionary = current.agreements[agreement_id]
	if claim_slot < int(agreement.start_slot) or claim_slot > int(agreement.end_slot):
		return _reject("Sponsor bonus claim is outside the agreement term.", current)
	var term: Dictionary = {}
	for candidate in agreement.bonus_terms:
		if candidate.event_id == event_id:
			term = candidate
			break
	if term.is_empty():
		return _reject("Sponsor agreement contains no bonus term for this event.", current)
	var claim_id = _bonus_claim_id(agreement_id, event_id)
	if current.bonus_claims.has(claim_id):
		return _reject("Sponsor event bonus was already claimed.", current, "already_claimed")
	var event: Dictionary = competition.events[event_id]
	var best = CampaignWeekendReceipt.MAX_ENTRANTS + 1
	for award in event.awards:
		if award.team_id == agreement.team_id:
			best = mini(best, int(award.position))
	if best > int(term.max_position):
		return _reject(
			"Settled result does not satisfy the sponsor bonus condition.", current, "not_earned"
		)
	var claim = {
		"id": claim_id,
		"agreement_id": agreement_id,
		"event_id": event_id,
		"result_digest": event.result_digest,
		"amount_minor": int(term.amount_minor),
		"claim_slot": claim_slot,
		"commitment_id":
		(
			"sponsorbonus."
			+ RaceStateValue.fingerprint([agreement_id, event_id, event.result_digest]).substr(
				0, 24
			)
		)
	}
	var data = current.duplicate(true)
	data.bonus_claims[claim_id] = claim
	return {
		"ok": true,
		"status": "earned",
		"error": "",
		"commercial": data,
		"claim": claim,
		"commitment_input":
		{
			"id": claim.commitment_id,
			"account_id": agreement.account_id,
			"source_id": agreement.id,
			"due_slot": claim_slot,
			"amount_minor": int(term.amount_minor),
			"category": "sponsor"
		}
	}


static func validate(data: Variant) -> String:
	if (
		not data is Dictionary
		or data.size() != 2
		or not data.get("agreements") is Dictionary
		or data.agreements.size() > MAX_AGREEMENTS
		or not data.get("bonus_claims") is Dictionary
		or data.bonus_claims.size() > MAX_AGREEMENTS * MAX_BONUSES
	):
		return "Campaign commercial projection is invalid."
	for agreement_id in data.agreements:
		if agreement_id != data.agreements[agreement_id].get("id"):
			return "Sponsor agreement key disagrees with its identity."
		var error = _agreement_error(data.agreements[agreement_id])
		if not error.is_empty():
			return error
	for claim_id in data.bonus_claims:
		var claim = data.bonus_claims[claim_id]
		if (
			claim_id != claim.get("id")
			or not data.agreements.has(claim.get("agreement_id"))
			or not _claim_error(claim).is_empty()
		):
			return "Sponsor bonus claim is invalid."
	return ""


static func guaranteed_commitments(agreement: Dictionary) -> Array:
	var result: Array = []
	for payment in agreement.guaranteed_payments:
		result.append(
			{
				"id": payment.id,
				"account_id": agreement.account_id,
				"source_id": agreement.id,
				"due_slot": int(payment.due_slot),
				"amount_minor": int(payment.amount_minor),
				"category": "sponsor"
			}
		)
	return result


static func _build(input: Dictionary, signed_slot: int) -> Dictionary:
	if (
		not input.get("guaranteed_payments", []) is Array
		or not input.get("appearances", []) is Array
		or not input.get("bonus_terms", []) is Array
	):
		return {}
	var data = {
		"id": input.get("id"),
		"sponsor_name": input.get("sponsor_name"),
		"account_id": input.get("account_id"),
		"team_id": input.get("team_id"),
		"signed_slot": signed_slot,
		"start_slot": input.get("start_slot"),
		"end_slot": input.get("end_slot"),
		"guaranteed_payments": input.get("guaranteed_payments", []).duplicate(true),
		"appearances": input.get("appearances", []).duplicate(true),
		"bonus_terms": input.get("bonus_terms", []).duplicate(true),
		"status": "active"
	}
	data["digest"] = RaceStateValue.fingerprint(data)
	return data if _agreement_error(data).is_empty() else {}


static func _agreement_error(data: Variant) -> String:
	if not data is Dictionary or data.size() != 12:
		return "Sponsor agreement has an unsupported shape."
	for key in ["id", "account_id", "team_id"]:
		if not CampaignIdentity.valid(data.get(key)):
			return "Sponsor agreement has an invalid " + key + "."
	if (
		not data.get("sponsor_name") is String
		or data.sponsor_name.strip_edges().is_empty()
		or data.sponsor_name.length() > MAX_NAME
	):
		return "Sponsor agreement has an invalid sponsor name."
	if (
		not RaceCheckpoint.integral(data.get("signed_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS)
		or not RaceCheckpoint.integral(
			data.get("start_slot"), int(data.signed_slot), CampaignClock.MAX_ELAPSED_SLOTS
		)
		or not RaceCheckpoint.integral(
			data.get("end_slot"), int(data.start_slot) + 1, CampaignClock.MAX_ELAPSED_SLOTS
		)
		or data.get("status") != "active"
	):
		return "Sponsor agreement has invalid timing or status."
	var error = _payments_error(data.guaranteed_payments, int(data.start_slot), int(data.end_slot))
	if not error.is_empty():
		return error
	error = _appearances_error(data.appearances, int(data.start_slot), int(data.end_slot))
	if not error.is_empty():
		return error
	error = _bonuses_error(data.bonus_terms)
	if not error.is_empty():
		return error
	var content = data.duplicate(true)
	content.erase("digest")
	if (
		not CampaignIdentity.valid_hash(data.get("digest"))
		or data.digest != RaceStateValue.fingerprint(content)
	):
		return "Sponsor agreement integrity check failed."
	return ""


static func _payments_error(items: Variant, start_slot: int, end_slot: int) -> String:
	if not items is Array or items.is_empty() or items.size() > MAX_PAYMENTS:
		return "Sponsor guaranteed payments must be a bounded non-empty array."
	var seen = {}
	for item in items:
		if (
			not item is Dictionary
			or item.size() != 3
			or not CampaignIdentity.valid(item.get("id"))
			or seen.has(item.id)
			or not RaceCheckpoint.integral(item.get("due_slot"), start_slot, end_slot)
			or not RaceCheckpoint.integral(item.get("amount_minor"), 1, CampaignEconomy.MAX_MINOR)
		):
			return "Sponsor guaranteed payment is invalid or duplicated."
		seen[item.id] = true
	return ""


static func _appearances_error(items: Variant, start_slot: int, end_slot: int) -> String:
	if not items is Array or items.size() > MAX_APPEARANCES:
		return "Sponsor appearances are not a bounded array."
	var seen = {}
	for item in items:
		if (
			not item is Dictionary
			or item.size() != 5
			or not CampaignIdentity.valid(item.get("id"))
			or not CampaignIdentity.valid(item.get("person_id"))
			or not CampaignIdentity.valid(item.get("assignment_id"))
			or seen.has(item.id)
			or not RaceCheckpoint.integral(item.get("start_slot"), start_slot, end_slot - 1)
			or not RaceCheckpoint.integral(item.get("end_slot"), int(item.start_slot) + 1, end_slot)
		):
			return "Sponsor appearance is invalid or duplicated."
		seen[item.id] = true
	return ""


static func _bonuses_error(items: Variant) -> String:
	if not items is Array or items.size() > MAX_BONUSES:
		return "Sponsor bonus terms are not a bounded array."
	var seen = {}
	for item in items:
		if (
			not item is Dictionary
			or item.size() != 3
			or not CampaignIdentity.valid(item.get("event_id"))
			or seen.has(item.event_id)
			or not RaceCheckpoint.integral(
				item.get("max_position"), 1, CampaignWeekendReceipt.MAX_ENTRANTS
			)
			or not RaceCheckpoint.integral(item.get("amount_minor"), 1, CampaignEconomy.MAX_MINOR)
		):
			return "Sponsor bonus term is invalid or duplicated."
		seen[item.event_id] = true
	return ""


static func _claim_error(data: Dictionary) -> String:
	if data.size() != 7:
		return "invalid shape"
	for key in ["id", "agreement_id", "event_id", "commitment_id"]:
		if not CampaignIdentity.valid(data.get(key)):
			return "invalid identity"
	if (
		not CampaignIdentity.valid_hash(data.get("result_digest"))
		or not RaceCheckpoint.integral(data.get("amount_minor"), 1, CampaignEconomy.MAX_MINOR)
		or not RaceCheckpoint.integral(data.get("claim_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS)
	):
		return "invalid evidence"
	return ""


static func _bonus_claim_id(agreement_id: String, event_id: String) -> String:
	return "sponsorclaim." + RaceStateValue.fingerprint([agreement_id, event_id]).substr(0, 24)


static func _reject(
	message: String, current: Dictionary, status: String = "rejected"
) -> Dictionary:
	return {"ok": false, "status": status, "error": message, "commercial": current.duplicate(true)}
