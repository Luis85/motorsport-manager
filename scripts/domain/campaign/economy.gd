class_name CampaignEconomy
extends RefCounted
## Integer-minor-unit cash ledger. Commitments and forecasts are later milestones.
const KIND = "motorsport-manager-campaign-economy"
const VERSION = 1
const MAX_EVENTS = 1024
const MAX_POSTINGS = 8192
const MAX_MINOR = CampaignWeekendPolicy.MAX_MINOR

static func create(campaign_id: String, account_id: String, opening_minor: int = 0) -> Dictionary:
	if not CampaignIdentity.valid(campaign_id) or not CampaignIdentity.valid(account_id):
		return {}
	if not RaceCheckpoint.integral(opening_minor, -MAX_MINOR, MAX_MINOR):
		return {}
	var data = {
		"kind": KIND,
		"version": VERSION,
		"campaign_id": campaign_id,
		"accounts": {
			account_id: {
				"opening_minor": opening_minor,
				"cash_minor": opening_minor,
				"postings": {}
			}
		},
		"events": {}
	}
	data["digest"] = RaceStateValue.fingerprint(data)
	return data

static func stage(current: Dictionary, receipt: Dictionary, policy: Dictionary, return_slot: int) -> Dictionary:
	var data = current.duplicate(true)
	var error = validate(data)
	if not error.is_empty():
		return {"ok": false, "status": "rejected", "error": error}
	error = CampaignWeekendPolicy.receipt_error(policy, receipt)
	if not error.is_empty():
		return {"ok": false, "status": "rejected", "error": error}
	if data.campaign_id != receipt.campaign_id or not data.accounts.has(policy.account_id):
		return {"ok": false, "status": "rejected", "error": "Campaign economy or account identity does not match this weekend."}
	if not RaceCheckpoint.integral(return_slot, 0, CampaignClock.MAX_ELAPSED_SLOTS):
		return {"ok": false, "status": "rejected", "error": "Campaign financial posting slot is invalid."}
	var event_id: String = receipt.campaign_event_id
	if data.events.has(event_id):
		var previous: Dictionary = data.events[event_id]
		if previous.result_digest == receipt.result_digest and previous.policy_digest == policy.digest:
			return {"ok": true, "status": "already_applied", "economy": data}
		return {"ok": false, "status": "conflict", "error": "Financial consequences already exist for this event under different evidence or rules."}
	if data.events.size() >= MAX_EVENTS:
		return {"ok": false, "status": "rejected", "error": "Campaign financial event history is full."}
	var best_position = receipt.classification.size() + 1
	for row in receipt.classification:
		if row.person_id in policy.account_people:
			best_position = mini(best_position, int(row.position))
	var account: Dictionary = data.accounts[policy.account_id]
	var posting_ids: Array = []
	var postings = [
		["entry", -int(policy.entry_cost_minor), "event_entry"],
		["participation", int(policy.participation_minor), "participation"],
		["position", CampaignWeekendPolicy.bonus_for(policy, best_position), "position_bonus"]
	]
	for item in postings:
		var amount = int(item[1])
		if amount == 0:
			continue
		var posting_id = "posting." + RaceStateValue.fingerprint([event_id, str(item[0])]).substr(0, 24)
		if account.postings.has(posting_id) or account.postings.size() >= MAX_POSTINGS:
			return {"ok": false, "status": "rejected", "error": "Campaign financial posting identity is duplicated or the ledger is full."}
		account.postings[posting_id] = {
			"id": posting_id,
			"event_id": event_id,
			"slot": return_slot,
			"amount_minor": amount,
			"category": str(item[2]),
			"source_digest": receipt.result_digest
		}
		posting_ids.append(posting_id)
		account.cash_minor = int(account.cash_minor) + amount
	data.events[event_id] = {
		"account_id": policy.account_id,
		"result_digest": receipt.result_digest,
		"policy_digest": policy.digest,
		"posting_ids": posting_ids
	}
	data.erase("digest")
	data["digest"] = RaceStateValue.fingerprint(data)
	error = validate(data)
	return {"ok": error.is_empty(), "status": "applied" if error.is_empty() else "rejected",
		"error": error, "economy": data if error.is_empty() else current.duplicate(true)}

static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign economy exceeds serialized-value limits."
	if not data is Dictionary or data.size() != 6 or data.get("kind") != KIND:
		return "Unsupported campaign economy projection."
	if not RaceCheckpoint.integral(data.get("version"), VERSION, VERSION) or not CampaignIdentity.valid(data.get("campaign_id")):
		return "Campaign economy version or identity is invalid."
	if not data.get("accounts") is Dictionary or data.accounts.is_empty() or not data.get("events") is Dictionary or data.events.size() > MAX_EVENTS:
		return "Campaign economy collections are invalid."
	var posting_owners = {}
	for account_id in data.accounts:
		if not CampaignIdentity.valid(account_id):
			return "Campaign economy has an invalid account identity."
		var account = data.accounts[account_id]
		if not account is Dictionary or account.size() != 3 or not account.get("postings") is Dictionary or account.postings.size() > MAX_POSTINGS:
			return "Campaign account has an unsupported shape."
		if not RaceCheckpoint.integral(account.get("opening_minor"), -MAX_MINOR, MAX_MINOR) or not RaceCheckpoint.integral(account.get("cash_minor"), -MAX_MINOR, MAX_MINOR):
			return "Campaign account has an invalid cash balance."
		var calculated = int(account.opening_minor)
		for posting_id in account.postings:
			var posting = account.postings[posting_id]
			if not CampaignIdentity.valid(posting_id) or posting_owners.has(posting_id):
				return "Campaign financial posting has an invalid or duplicate identity."
			posting_owners[posting_id] = account_id
			if not posting is Dictionary or posting.size() != 6 or posting.get("id") != posting_id:
				return "Campaign financial posting has an unsupported shape."
			if not CampaignIdentity.valid(posting.get("event_id")) or not RaceCheckpoint.integral(posting.get("slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS):
				return "Campaign financial posting has invalid event timing."
			if not RaceCheckpoint.integral(posting.get("amount_minor"), -MAX_MINOR, MAX_MINOR) or int(posting.amount_minor) == 0:
				return "Campaign financial posting has an invalid amount."
			if posting.get("category") not in ["event_entry", "participation", "position_bonus"] or not CampaignIdentity.valid_hash(posting.get("source_digest")):
				return "Campaign financial posting has invalid provenance."
			calculated += int(posting.amount_minor)
		if calculated != int(account.cash_minor):
			return "Campaign account cash disagrees with its postings."
	var indexed_postings = {}
	for event_id in data.events:
		if not CampaignIdentity.valid(event_id):
			return "Campaign economy has an invalid event identity."
		var event = data.events[event_id]
		if not event is Dictionary or event.size() != 4 or not CampaignIdentity.valid(event.get("account_id")) or not data.accounts.has(event.account_id):
			return "Campaign financial event has an unsupported account."
		for key in ["result_digest", "policy_digest"]:
			if not CampaignIdentity.valid_hash(event.get(key)):
				return "Campaign financial event has an invalid source digest."
		if not event.get("posting_ids") is Array or event.posting_ids.size() > 3:
			return "Campaign financial event has an invalid posting index."
		for posting_id in event.posting_ids:
			if indexed_postings.has(posting_id):
				return "Campaign financial posting is indexed more than once."
			indexed_postings[posting_id] = true
			if posting_owners.get(posting_id) != event.account_id:
				return "Campaign financial event references a missing posting."
			if data.accounts[event.account_id].postings[posting_id].event_id != event_id:
				return "Campaign financial posting belongs to another event."
	if indexed_postings.size() != posting_owners.size():
		return "Campaign account contains a posting without an event index."
	var content = data.duplicate(true)
	content.erase("digest")
	if not CampaignIdentity.valid_hash(data.get("digest")) or data.digest != RaceStateValue.fingerprint(content):
		return "Campaign economy integrity check failed."
	return ""
