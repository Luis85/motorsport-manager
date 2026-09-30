class_name CampaignEconomyLegacy
extends RefCounted
## Validation and lossless posting-shape migration for economy version 1.
const KIND = "motorsport-manager-campaign-economy"
const VERSION = 1
const MAX_EVENTS = 1024
const MAX_POSTINGS = 8192
const MAX_MINOR = CampaignWeekendPolicy.MAX_MINOR
const EVENT_CATEGORIES = ["event_entry", "participation", "position_bonus"]

static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign economy exceeds serialized-value limits."
	if not data is Dictionary or data.size() != 6 or data.get("kind") != KIND:
		return "Unsupported legacy campaign economy projection."
	if not RaceCheckpoint.integral(data.get("version"), VERSION, VERSION) \
			or not CampaignIdentity.valid(data.get("campaign_id")):
		return "Legacy campaign economy version or identity is invalid."
	if not data.get("accounts") is Dictionary or data.accounts.is_empty() \
			or not data.get("events") is Dictionary or data.events.size() > MAX_EVENTS:
		return "Legacy campaign economy collections are invalid."
	var posting_owners = {}
	for account_id in data.accounts:
		if not CampaignIdentity.valid(account_id):
			return "Legacy campaign economy has an invalid account identity."
		var account = data.accounts[account_id]
		if not account is Dictionary or account.size() != 3 \
				or not account.get("postings") is Dictionary or account.postings.size() > MAX_POSTINGS:
			return "Legacy campaign account has an unsupported shape."
		if not RaceCheckpoint.integral(account.get("opening_minor"), -MAX_MINOR, MAX_MINOR) \
				or not RaceCheckpoint.integral(account.get("cash_minor"), -MAX_MINOR, MAX_MINOR):
			return "Legacy campaign account has an invalid cash balance."
		var calculated = int(account.opening_minor)
		for posting_id in account.postings:
			var posting = account.postings[posting_id]
			if not CampaignIdentity.valid(posting_id) or posting_owners.has(posting_id):
				return "Legacy campaign financial posting has an invalid or duplicate identity."
			posting_owners[posting_id] = account_id
			if not posting is Dictionary or posting.size() != 6 or posting.get("id") != posting_id:
				return "Legacy campaign financial posting has an unsupported shape."
			if not CampaignIdentity.valid(posting.get("event_id")) \
					or not RaceCheckpoint.integral(posting.get("slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS):
				return "Legacy campaign financial posting has invalid event timing."
			if not RaceCheckpoint.integral(posting.get("amount_minor"), -MAX_MINOR, MAX_MINOR) \
					or int(posting.amount_minor) == 0:
				return "Legacy campaign financial posting has an invalid amount."
			if posting.get("category") not in EVENT_CATEGORIES \
					or not CampaignIdentity.valid_hash(posting.get("source_digest")):
				return "Legacy campaign financial posting has invalid provenance."
			calculated += int(posting.amount_minor)
		if calculated != int(account.cash_minor):
			return "Legacy campaign account cash disagrees with its postings."
	var indexed_postings = {}
	for event_id in data.events:
		if not CampaignIdentity.valid(event_id):
			return "Legacy campaign economy has an invalid event identity."
		var event = data.events[event_id]
		if not event is Dictionary or event.size() != 4 \
				or not CampaignIdentity.valid(event.get("account_id")) or not data.accounts.has(event.account_id):
			return "Legacy campaign financial event has an unsupported account."
		for key in ["result_digest", "policy_digest"]:
			if not CampaignIdentity.valid_hash(event.get(key)):
				return "Legacy campaign financial event has an invalid source digest."
		if not event.get("posting_ids") is Array or event.posting_ids.size() > 3:
			return "Legacy campaign financial event has an invalid posting index."
		for posting_id in event.posting_ids:
			if indexed_postings.has(posting_id):
				return "Legacy campaign financial posting is indexed more than once."
			indexed_postings[posting_id] = true
			if posting_owners.get(posting_id) != event.account_id:
				return "Legacy campaign financial event references a missing posting."
			if data.accounts[event.account_id].postings[posting_id].event_id != event_id:
				return "Legacy campaign financial posting belongs to another event."
	if indexed_postings.size() != posting_owners.size():
		return "Legacy campaign account contains a posting without an event index."
	var content = data.duplicate(true)
	content.erase("digest")
	if not CampaignIdentity.valid_hash(data.get("digest")) \
			or data.digest != RaceStateValue.fingerprint(content):
		return "Legacy campaign economy integrity check failed."
	return ""

static func upgrade(data: Dictionary, authority_from_slot: int) -> Dictionary:
	if not validate(data).is_empty() \
			or not RaceCheckpoint.integral(authority_from_slot, 0, CampaignClock.MAX_ELAPSED_SLOTS):
		return {}
	var accounts = {}
	for account_id in data.accounts:
		var legacy: Dictionary = data.accounts[account_id]
		var postings = {}
		for posting_id in legacy.postings:
			var old: Dictionary = legacy.postings[posting_id]
			postings[posting_id] = {
				"id": posting_id,
				"source_kind": "event",
				"source_id": old.event_id,
				"slot": old.slot,
				"amount_minor": old.amount_minor,
				"category": old.category,
				"source_digest": old.source_digest
			}
		accounts[account_id] = {
			"opening_minor": legacy.opening_minor,
			"cash_minor": legacy.cash_minor,
			"postings": postings
		}
	var upgraded = {
		"kind": KIND,
		"version": 2,
		"campaign_id": data.campaign_id,
		"authority_from_slot": authority_from_slot,
		"accounts": accounts,
		"events": data.events.duplicate(true),
		"commitments": {},
		"reserve_policies": {}
	}
	upgraded["digest"] = RaceStateValue.fingerprint(upgraded)
	return upgraded
