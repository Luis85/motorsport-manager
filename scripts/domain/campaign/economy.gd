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

static func create(campaign_id: String, account_id: String, opening_minor: int = 0,
		authority_from_slot: int = 0) -> Dictionary:
	if not CampaignIdentity.valid(campaign_id) or not CampaignIdentity.valid(account_id):
		return {}
	if not RaceCheckpoint.integral(opening_minor, -MAX_MINOR, MAX_MINOR) \
			or not RaceCheckpoint.integral(authority_from_slot, 0, CampaignClock.MAX_ELAPSED_SLOTS):
		return {}
	var data = {
		"kind": KIND,
		"version": VERSION,
		"campaign_id": campaign_id,
		"authority_from_slot": authority_from_slot,
		"accounts": {
			account_id: {
				"opening_minor": opening_minor,
				"cash_minor": opening_minor,
				"postings": {}
			}
		},
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

static func stage(current: Dictionary, receipt: Dictionary, policy: Dictionary, return_slot: int) -> Dictionary:
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
		if previous.result_digest == receipt.result_digest and previous.policy_digest == policy.digest:
			return {"ok": true, "status": "already_applied", "error": "", "economy": data}
		return _reject("Financial consequences already exist for this event under different evidence or rules.", current, "conflict")
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
		var posting_id = _append_posting(account, "event", event_id, return_slot,
			int(item[1]), str(item[2]), receipt.result_digest, str(item[0]))
		if posting_id.is_empty():
			return _reject("Campaign financial posting identity, capacity or cash range is invalid.", current)
		posting_ids.append(posting_id)
	data.accounts[policy.account_id] = account
	data.events[event_id] = {
		"account_id": policy.account_id,
		"result_digest": receipt.result_digest,
		"policy_digest": policy.digest,
		"posting_ids": posting_ids
	}
	return _validated(data, "applied", current)

static func correct_event(current: Dictionary, receipt: Dictionary,
		policy: Dictionary, return_slot: int) -> Dictionary:
	var data = upgrade(current, return_slot)
	if data.is_empty(): return _reject("Campaign economy could not be validated for correction.", current)
	var error = CampaignWeekendPolicy.receipt_error(policy, receipt)
	if not error.is_empty(): return _reject(error, current)
	var event_id: String = receipt.campaign_event_id
	if not data.events.has(event_id): return _reject("Financial correction requires an existing settled event.", current)
	var prior: Dictionary = data.events[event_id]
	if prior.policy_digest != policy.digest: return _reject("Financial correction cannot silently change the event policy.", current)
	var account: Dictionary = data.accounts[prior.account_id]
	for posting_id in prior.posting_ids:
		if not account.postings.has(posting_id): return _reject("Financial correction is missing an indexed prior posting.", current)
		account.cash_minor = int(account.cash_minor) - int(account.postings[posting_id].amount_minor)
		account.postings.erase(posting_id)
	data.accounts[prior.account_id] = account
	data.events.erase(event_id)
	_seal(data)
	error = validate(data)
	if not error.is_empty(): return _reject(error, current)
	var applied = stage(data, receipt, policy, return_slot)
	if not applied.ok: return _reject(applied.error, current)
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
		return _reject("Campaign cash commitment is invalid or references an unknown account.", current)
	if data.commitments.has(commitment.id) or data.commitments.size() >= MAX_COMMITMENTS:
		return _reject("Campaign cash commitment identity is duplicated or the registry is full.", current)
	data.commitments[commitment.id] = commitment
	return _validated(data, "added", current)

static func cancel_commitment(current: Dictionary, commitment_id: String, resolution_slot: int) -> Dictionary:
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

static func set_reserve_policy(current: Dictionary, account_id: String,
		minimum_cash_minor: int, effective_slot: int) -> Dictionary:
	var data = upgrade(current, effective_slot)
	if data.is_empty():
		return _reject("Campaign economy could not be upgraded or validated.", current)
	if not data.accounts.has(account_id) or effective_slot < int(data.authority_from_slot):
		return _reject("Campaign reserve policy references an unknown account or predates authority.", current)
	var policy = CampaignReservePolicy.build(account_id, minimum_cash_minor, effective_slot)
	if policy.is_empty():
		return _reject("Campaign reserve policy is invalid.", current)
	data.reserve_policies[account_id] = policy
	return _validated(data, "policy_set", current)

static func settle_due(current: Dictionary, through_slot: int) -> Dictionary:
	var data = upgrade(current, through_slot)
	if data.is_empty():
		return _reject("Campaign economy could not be upgraded or validated.", current)
	if not RaceCheckpoint.integral(through_slot, int(data.authority_from_slot), CampaignClock.MAX_ELAPSED_SLOTS):
		return _reject("Campaign commitment settlement slot is outside recorded authority.", current)
	var settled_count = 0
	for commitment_id in _due_ids(data.commitments, through_slot):
		var commitment: Dictionary = data.commitments[commitment_id]
		var account: Dictionary = data.accounts[commitment.account_id]
		var posting_id = _append_posting(account, "commitment", commitment.id,
			int(commitment.due_slot), int(commitment.amount_minor), commitment.category,
			commitment.terms_digest, "settlement")
		if posting_id.is_empty():
			return _reject("Due commitment could not create a unique bounded cash posting.", current)
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
	if not RaceStateValue.serializable(data):
		return "Campaign economy exceeds serialized-value limits."
	if not data is Dictionary or data.get("kind") != KIND:
		return "Unsupported campaign economy projection."
	if RaceCheckpoint.integral(data.get("version"), LEGACY_VERSION, LEGACY_VERSION):
		return CampaignEconomyLegacy.validate(data)
	if not RaceCheckpoint.integral(data.get("version"), VERSION, VERSION) or data.size() != 9 \
			or not CampaignIdentity.valid(data.get("campaign_id")) \
			or not RaceCheckpoint.integral(data.get("authority_from_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS):
		return "Campaign economy version, shape, identity or authority is invalid."
	if not data.get("accounts") is Dictionary or data.accounts.is_empty() \
			or not data.get("events") is Dictionary or data.events.size() > MAX_EVENTS \
			or not data.get("commitments") is Dictionary or data.commitments.size() > MAX_COMMITMENTS \
			or not data.get("reserve_policies") is Dictionary:
		return "Campaign economy collections are invalid."
	var posting_owners = {}
	var posting_records = {}
	for account_id in data.accounts:
		if not CampaignIdentity.valid(account_id):
			return "Campaign economy has an invalid account identity."
		var account = data.accounts[account_id]
		if not account is Dictionary or account.size() != 3 \
				or not account.get("postings") is Dictionary or account.postings.size() > MAX_POSTINGS:
			return "Campaign account has an unsupported shape."
		if not RaceCheckpoint.integral(account.get("opening_minor"), -MAX_MINOR, MAX_MINOR) \
				or not RaceCheckpoint.integral(account.get("cash_minor"), -MAX_MINOR, MAX_MINOR):
			return "Campaign account has an invalid cash balance."
		var calculated = int(account.opening_minor)
		for posting_id in account.postings:
			var posting = account.postings[posting_id]
			if not CampaignIdentity.valid(posting_id) or posting_owners.has(posting_id):
				return "Campaign financial posting has an invalid or duplicate identity."
			var posting_error = _posting_error(posting_id, posting)
			if not posting_error.is_empty():
				return posting_error
			posting_owners[posting_id] = account_id
			posting_records[posting_id] = posting
			calculated += int(posting.amount_minor)
		if calculated != int(account.cash_minor):
			return "Campaign account cash disagrees with its postings."
	var indexed = {}
	var event_error = _event_index_error(data, posting_owners, posting_records, indexed)
	if not event_error.is_empty():
		return event_error
	for commitment_id in data.commitments:
		var commitment = data.commitments[commitment_id]
		if commitment_id != commitment.get("id"):
			return "Campaign cash commitment key disagrees with its identity."
		var commitment_error = CampaignCashCommitment.validate(commitment)
		if not commitment_error.is_empty():
			return commitment_error
		if not data.accounts.has(commitment.account_id) \
				or int(commitment.created_slot) < int(data.authority_from_slot):
			return "Campaign cash commitment account or authority is invalid."
		if commitment.status == "settled":
			var posting_id: String = commitment.settlement_posting_id
			if indexed.has(posting_id) or posting_owners.get(posting_id) != commitment.account_id:
				return "Settled campaign cash commitment has a missing or multiply indexed posting."
			var posting: Dictionary = posting_records[posting_id]
			if posting.source_kind != "commitment" or posting.source_id != commitment_id \
					or int(posting.slot) != int(commitment.due_slot) \
					or int(posting.amount_minor) != int(commitment.amount_minor) \
					or posting.category != commitment.category \
					or posting.source_digest != commitment.terms_digest:
				return "Commitment settlement posting disagrees with its binding terms."
			indexed[posting_id] = true
	for account_id in data.reserve_policies:
		if not data.accounts.has(account_id) or data.reserve_policies[account_id].get("account_id") != account_id:
			return "Campaign reserve policy references an unknown account."
		var policy_error = CampaignReservePolicy.validate(data.reserve_policies[account_id])
		if not policy_error.is_empty():
			return policy_error
		if int(data.reserve_policies[account_id].effective_slot) < int(data.authority_from_slot):
			return "Campaign reserve policy predates commitment authority."
	if indexed.size() != posting_owners.size():
		return "Campaign account contains a posting without exactly one source index."
	var content = data.duplicate(true)
	content.erase("digest")
	if not CampaignIdentity.valid_hash(data.get("digest")) or data.digest != RaceStateValue.fingerprint(content):
		return "Campaign economy integrity check failed."
	return ""

static func _posting_error(posting_id: String, posting: Variant) -> String:
	if not posting is Dictionary or posting.size() != 7 or posting.get("id") != posting_id:
		return "Campaign financial posting has an unsupported shape."
	if posting.get("source_kind") not in ["event", "commitment"] \
			or not CampaignIdentity.valid(posting.get("source_id")) \
			or not RaceCheckpoint.integral(posting.get("slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS):
		return "Campaign financial posting has invalid source timing."
	if not RaceCheckpoint.integral(posting.get("amount_minor"), -MAX_MINOR, MAX_MINOR) \
			or int(posting.amount_minor) == 0 or not CampaignIdentity.valid_hash(posting.get("source_digest")):
		return "Campaign financial posting has an invalid amount or provenance."
	if posting.source_kind == "event" and posting.get("category") not in EVENT_CATEGORIES:
		return "Campaign event posting has an invalid category."
	if posting.source_kind == "commitment" and posting.get("category") not in CampaignCashCommitment.CATEGORIES:
		return "Campaign commitment posting has an invalid category."
	return ""

static func _event_index_error(data: Dictionary, owners: Dictionary,
		records: Dictionary, indexed: Dictionary) -> String:
	for event_id in data.events:
		if not CampaignIdentity.valid(event_id):
			return "Campaign economy has an invalid event identity."
		var event = data.events[event_id]
		if not event is Dictionary or event.size() != 4 \
				or not CampaignIdentity.valid(event.get("account_id")) or not data.accounts.has(event.account_id):
			return "Campaign financial event has an unsupported account."
		for key in ["result_digest", "policy_digest"]:
			if not CampaignIdentity.valid_hash(event.get(key)):
				return "Campaign financial event has an invalid source digest."
		if not event.get("posting_ids") is Array or event.posting_ids.size() > 3:
			return "Campaign financial event has an invalid posting index."
		for posting_id in event.posting_ids:
			if indexed.has(posting_id) or owners.get(posting_id) != event.account_id:
				return "Campaign financial event references a missing or multiply indexed posting."
			var posting: Dictionary = records[posting_id]
			if posting.source_kind != "event" or posting.source_id != event_id \
					or posting.source_digest != event.result_digest:
				return "Campaign financial posting belongs to another event or result."
			indexed[posting_id] = true
	return ""

static func _append_posting(account: Dictionary, source_kind: String, source_id: String,
		slot: int, amount_minor: int, category: String, source_digest: String, salt: String) -> String:
	var posting_id = "posting." + RaceStateValue.fingerprint([source_kind, source_id, salt]).substr(0, 24)
	var next_cash = int(account.cash_minor) + amount_minor
	if account.postings.has(posting_id) or account.postings.size() >= MAX_POSTINGS \
			or not RaceCheckpoint.integral(next_cash, -MAX_MINOR, MAX_MINOR):
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
			if int(item.due_slot) < int(other.due_slot) \
					or (int(item.due_slot) == int(other.due_slot) and commitment_id < ordered[index]):
				ordered.insert(index, commitment_id)
				inserted = true
				break
		if not inserted:
			ordered.append(commitment_id)
	return ordered

static func _validated(data: Dictionary, status: String, current: Dictionary) -> Dictionary:
	_seal(data)
	var error = validate(data)
	return {"ok": error.is_empty(), "status": status if error.is_empty() else "rejected",
		"error": error, "economy": data if error.is_empty() else current.duplicate(true)}

static func _reject(message: String, current: Dictionary, status: String = "rejected") -> Dictionary:
	return {"ok": false, "status": status, "error": message, "economy": current.duplicate(true)}

static func _seal(data: Dictionary) -> void:
	data.erase("digest")
	data["digest"] = RaceStateValue.fingerprint(data)
