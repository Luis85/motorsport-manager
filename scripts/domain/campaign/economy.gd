class_name CampaignEconomy
extends RefCounted
## Integer-minor-unit factual ledger plus binding future cash commitments.
## Forecast assumptions are detached inputs and never mutate this authority.
const KIND = "motorsport-manager-campaign-economy"
const VERSION = 2
const LEGACY_VERSION = 1
const MAX_EVENTS = 1024
const MAX_POSTINGS = 8192
const MAX_COMMITMENTS = 8192
const MAX_MINOR = CampaignWeekendPolicy.MAX_MINOR
const EVENT_CATEGORIES = ["event_entry", "participation", "position_bonus"]


static func create(
	campaign_id: String, account_id: String, opening_minor: int = 0, authority_from_slot: int = 0
) -> Dictionary:
	if not CampaignIdentity.valid(campaign_id) or not CampaignIdentity.valid(account_id):
		return {}
	if (
		not RaceCheckpoint.integral(opening_minor, -MAX_MINOR, MAX_MINOR)
		or not RaceCheckpoint.integral(authority_from_slot, 0, CampaignClock.MAX_ELAPSED_SLOTS)
	):
		return {}
	var data = {
		"kind": KIND,
		"version": VERSION,
		"campaign_id": campaign_id,
		"authority_from_slot": authority_from_slot,
		"accounts":
		{account_id: {"opening_minor": opening_minor, "cash_minor": opening_minor, "postings": {}}},
		"events": {},
		"commitments": {},
		"reserve_policies": {}
	}
	_seal(data)
	return data if validate(data).is_empty() else {}


static func upgrade(data: Dictionary, authority_from_slot: int) -> Dictionary:
	var error = validate(data)
	if not error.is_empty():
		return {}
	if int(data.version) == VERSION:
		return data.duplicate(true)
	var upgraded = CampaignEconomyLegacy.upgrade(data, authority_from_slot)
	return upgraded if not upgraded.is_empty() and validate(upgraded).is_empty() else {}


static func stage(
	current: Dictionary, receipt: Dictionary, policy: Dictionary, return_slot: int
) -> Dictionary:
	var data = upgrade(current, return_slot)
	if data.is_empty():
		return _reject("Campaign economy could not be upgraded or validated.", current)
	var error = CampaignWeekendPolicy.receipt_error(policy, receipt)
	if not error.is_empty():
		return _reject(error, current)
	if data.campaign_id != receipt.campaign_id or not data.accounts.has(policy.account_id):
		return _reject("Campaign economy or account identity does not match this weekend.", current)
	if not RaceCheckpoint.integral(return_slot, 0, CampaignClock.MAX_ELAPSED_SLOTS):
		return _reject("Campaign financial posting slot is invalid.", current)
	var event_id: String = receipt.campaign_event_id
	if data.events.has(event_id):
		var previous: Dictionary = data.events[event_id]
		if (
			previous.result_digest == receipt.result_digest
			and previous.policy_digest == policy.digest
		):
			return {"ok": true, "status": "already_applied", "error": "", "economy": data}
		return _reject(
			"Financial consequences already exist for this event under different evidence or rules.",
			current,
			"conflict"
		)
	if data.events.size() >= MAX_EVENTS:
		return _reject("Campaign financial event history is full.", current)
	var best_position = receipt.classification.size() + 1
	for row in receipt.classification:
		if row.person_id in policy.account_people:
			best_position = mini(best_position, int(row.position))
	var account: Dictionary = data.accounts[policy.account_id]
	var posting_ids: Array = []
	for item in [
		["entry", -int(policy.entry_cost_minor), "event_entry"],
		["participation", int(policy.participation_minor), "participation"],
		["position", CampaignWeekendPolicy.bonus_for(policy, best_position), "position_bonus"]
	]:
		if int(item[1]) == 0:
			continue
		var posting_id = _append_posting(
			account,
			"event",
			event_id,
			return_slot,
			int(item[1]),
			str(item[2]),
			receipt.result_digest,
			str(item[0])
		)
		if posting_id.is_empty():
			return _reject(
				"Campaign financial posting identity, capacity or cash range is invalid.", current
			)
		posting_ids.append(posting_id)
	data.accounts[policy.account_id] = account
	data.events[event_id] = {
		"account_id": policy.account_id,
		"result_digest": receipt.result_digest,
		"policy_digest": policy.digest,
		"posting_ids": posting_ids
	}
	return _validated(data, "applied", current)


static func correct_event(
	current: Dictionary, receipt: Dictionary, policy: Dictionary, return_slot: int
) -> Dictionary:
	var data = upgrade(current, return_slot)
	if data.is_empty():
		return _reject("Campaign economy could not be validated for correction.", current)
	var error = CampaignWeekendPolicy.receipt_error(policy, receipt)
	if not error.is_empty():
		return _reject(error, current)
	var event_id: String = receipt.campaign_event_id
	if not data.events.has(event_id):
		return _reject("Financial correction requires an existing settled event.", current)
	var prior: Dictionary = data.events[event_id]
	if prior.policy_digest != policy.digest:
		return _reject("Financial correction cannot silently change the event policy.", current)
	var account: Dictionary = data.accounts[prior.account_id]
	for posting_id in prior.posting_ids:
		if not account.postings.has(posting_id):
			return _reject("Financial correction is missing an indexed prior posting.", current)
		account.cash_minor = (
			int(account.cash_minor) - int(account.postings[posting_id].amount_minor)
		)
		account.postings.erase(posting_id)
	data.accounts[prior.account_id] = account
	data.events.erase(event_id)
	_seal(data)
	error = validate(data)
	if not error.is_empty():
		return _reject(error, current)
	var applied = stage(data, receipt, policy, return_slot)
	if not applied.ok:
		return _reject(applied.error, current)
	applied.status = "corrected"
	return applied


static func add_commitment(current: Dictionary, input: Dictionary, created_slot: int) -> Dictionary:
	var data = upgrade(current, created_slot)
	if data.is_empty():
		return _reject("Campaign economy could not be upgraded or validated.", current)
	if created_slot < int(data.authority_from_slot):
		return _reject("Cash commitment predates this economy's commitment authority.", current)
	var commitment = CampaignCashCommitment.build(input, created_slot)
	if commitment.is_empty() or not data.accounts.has(commitment.get("account_id")):
		return _reject(
			"Campaign cash commitment is invalid or references an unknown account.", current
		)
	if data.commitments.has(commitment.id) or data.commitments.size() >= MAX_COMMITMENTS:
		return _reject(
			"Campaign cash commitment identity is duplicated or the registry is full.", current
		)
	data.commitments[commitment.id] = commitment
	return _validated(data, "added", current)


static func cancel_commitment(
	current: Dictionary, commitment_id: String, resolution_slot: int
) -> Dictionary:
	var data = upgrade(current, resolution_slot)
	if data.is_empty():
		return _reject("Campaign economy could not be upgraded or validated.", current)
	if not data.commitments.has(commitment_id) or data.commitments[commitment_id].status != "open":
		return _reject("Only an open campaign cash commitment can be cancelled.", current)
	var commitment: Dictionary = data.commitments[commitment_id]
	commitment.status = "cancelled"
	commitment.resolution_slot = resolution_slot
	data.commitments[commitment_id] = commitment
	return _validated(data, "cancelled", current)


static func set_reserve_policy(
	current: Dictionary, account_id: String, minimum_cash_minor: int, effective_slot: int
) -> Dictionary:
	var data = upgrade(current, effective_slot)
	if data.is_empty():
		return _reject("Campaign economy could not be upgraded or validated.", current)
	if not data.accounts.has(account_id) or effective_slot < int(data.authority_from_slot):
		return _reject(
			"Campaign reserve policy references an unknown account or predates authority.", current
		)
	var policy = CampaignReservePolicy.build(account_id, minimum_cash_minor, effective_slot)
	if policy.is_empty():
		return _reject("Campaign reserve policy is invalid.", current)
	data.reserve_policies[account_id] = policy
	return _validated(data, "policy_set", current)


static func settle_due(current: Dictionary, through_slot: int) -> Dictionary:
	var data = upgrade(current, through_slot)
	if data.is_empty():
		return _reject("Campaign economy could not be upgraded or validated.", current)
	if not RaceCheckpoint.integral(
		through_slot, int(data.authority_from_slot), CampaignClock.MAX_ELAPSED_SLOTS
	):
		return _reject(
			"Campaign commitment settlement slot is outside recorded authority.", current
		)
	var settled_count = 0
	for commitment_id in _due_ids(data.commitments, through_slot):
		var commitment: Dictionary = data.commitments[commitment_id]
		var account: Dictionary = data.accounts[commitment.account_id]
		var posting_id = _append_posting(
			account,
			"commitment",
			commitment.id,
			int(commitment.due_slot),
			int(commitment.amount_minor),
			commitment.category,
			commitment.terms_digest,
			"settlement"
		)
		if posting_id.is_empty():
			return _reject(
				"Due commitment could not create a unique bounded cash posting.", current
			)
		commitment.status = "settled"
		commitment.resolution_slot = commitment.due_slot
		commitment.settlement_posting_id = posting_id
		data.accounts[commitment.account_id] = account
		data.commitments[commitment_id] = commitment
		settled_count += 1
	var result = _validated(data, "settled_due", current)
	if result.ok:
		result["settled_count"] = settled_count
	return result


static func validate(data: Variant) -> String:
	return CampaignEconomyValidation.validate(data)


static func _append_posting(
	account: Dictionary,
	source_kind: String,
	source_id: String,
	slot: int,
	amount_minor: int,
	category: String,
	source_digest: String,
	salt: String
) -> String:
	var posting_id = (
		"posting." + RaceStateValue.fingerprint([source_kind, source_id, salt]).substr(0, 24)
	)
	var next_cash = int(account.cash_minor) + amount_minor
	if (
		account.postings.has(posting_id)
		or account.postings.size() >= MAX_POSTINGS
		or not RaceCheckpoint.integral(next_cash, -MAX_MINOR, MAX_MINOR)
	):
		return ""
	account.postings[posting_id] = {
		"id": posting_id,
		"source_kind": source_kind,
		"source_id": source_id,
		"slot": slot,
		"amount_minor": amount_minor,
		"category": category,
		"source_digest": source_digest
	}
	account.cash_minor = next_cash
	return posting_id


static func _due_ids(commitments: Dictionary, through_slot: int) -> Array:
	var ordered: Array = []
	for commitment_id in commitments:
		var item: Dictionary = commitments[commitment_id]
		if item.status != "open" or int(item.due_slot) > through_slot:
			continue
		var inserted = false
		for index in range(ordered.size()):
			var other: Dictionary = commitments[ordered[index]]
			if (
				int(item.due_slot) < int(other.due_slot)
				or (int(item.due_slot) == int(other.due_slot) and commitment_id < ordered[index])
			):
				ordered.insert(index, commitment_id)
				inserted = true
				break
		if not inserted:
			ordered.append(commitment_id)
	return ordered


static func _validated(data: Dictionary, status: String, current: Dictionary) -> Dictionary:
	_seal(data)
	var error = validate(data)
	return {
		"ok": error.is_empty(),
		"status": status if error.is_empty() else "rejected",
		"error": error,
		"economy": data if error.is_empty() else current.duplicate(true)
	}


static func _reject(
	message: String, current: Dictionary, status: String = "rejected"
) -> Dictionary:
	return {"ok": false, "status": status, "error": message, "economy": current.duplicate(true)}


static func _seal(data: Dictionary) -> void:
	data.erase("digest")
	data["digest"] = RaceStateValue.fingerprint(data)
