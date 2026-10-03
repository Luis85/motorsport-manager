class_name CampaignEconomyValidation
extends RefCounted
## Pure validation of detached campaign records.
const KIND = CampaignEconomy.KIND
const VERSION = CampaignEconomy.VERSION
const LEGACY_VERSION = CampaignEconomy.LEGACY_VERSION
const MAX_EVENTS = CampaignEconomy.MAX_EVENTS
const MAX_POSTINGS = CampaignEconomy.MAX_POSTINGS
const MAX_COMMITMENTS = CampaignEconomy.MAX_COMMITMENTS
const MAX_MINOR = CampaignEconomy.MAX_MINOR
const EVENT_CATEGORIES = CampaignEconomy.EVENT_CATEGORIES


static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign economy exceeds serialized-value limits."
	if not data is Dictionary or data.get("kind") != KIND:
		return "Unsupported campaign economy projection."
	if RaceCheckpoint.integral(data.get("version"), LEGACY_VERSION, LEGACY_VERSION):
		return CampaignEconomyLegacy.validate(data)
	if (
		not RaceCheckpoint.integral(data.get("version"), VERSION, VERSION)
		or data.size() != 9
		or not CampaignIdentity.valid(data.get("campaign_id"))
		or not RaceCheckpoint.integral(
			data.get("authority_from_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS
		)
	):
		return "Campaign economy version, shape, identity or authority is invalid."
	if (
		not data.get("accounts") is Dictionary
		or data.accounts.is_empty()
		or not data.get("events") is Dictionary
		or data.events.size() > MAX_EVENTS
		or not data.get("commitments") is Dictionary
		or data.commitments.size() > MAX_COMMITMENTS
		or not data.get("reserve_policies") is Dictionary
	):
		return "Campaign economy collections are invalid."
	var posting_owners = {}
	var posting_records = {}
	var accounts_error = _accounts_error(data, posting_owners, posting_records)
	if not accounts_error.is_empty():
		return accounts_error
	var indexed = {}
	var event_error = _event_index_error(data, posting_owners, posting_records, indexed)
	if not event_error.is_empty():
		return event_error
	var commitments_error = _commitments_error(data, posting_owners, posting_records, indexed)
	if not commitments_error.is_empty():
		return commitments_error
	for account_id in data.reserve_policies:
		if (
			not data.accounts.has(account_id)
			or not data.reserve_policies[account_id] is Dictionary
			or data.reserve_policies[account_id].get("account_id") != account_id
		):
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
	if (
		not CampaignIdentity.valid_hash(data.get("digest"))
		or data.digest != RaceStateValue.fingerprint(content)
	):
		return "Campaign economy integrity check failed."
	return ""


static func _posting_error(posting_id: String, posting: Variant) -> String:
	if not posting is Dictionary or posting.size() != 7 or posting.get("id") != posting_id:
		return "Campaign financial posting has an unsupported shape."
	if (
		posting.get("source_kind") not in ["event", "commitment"]
		or not CampaignIdentity.valid(posting.get("source_id"))
		or not RaceCheckpoint.integral(posting.get("slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS)
	):
		return "Campaign financial posting has invalid source timing."
	if (
		not RaceCheckpoint.integral(posting.get("amount_minor"), -MAX_MINOR, MAX_MINOR)
		or int(posting.amount_minor) == 0
		or not CampaignIdentity.valid_hash(posting.get("source_digest"))
	):
		return "Campaign financial posting has an invalid amount or provenance."
	if posting.source_kind == "event" and posting.get("category") not in EVENT_CATEGORIES:
		return "Campaign event posting has an invalid category."
	if (
		posting.source_kind == "commitment"
		and posting.get("category") not in CampaignCashCommitment.CATEGORIES
	):
		return "Campaign commitment posting has an invalid category."
	return ""


static func _event_index_error(
	data: Dictionary, owners: Dictionary, records: Dictionary, indexed: Dictionary
) -> String:
	for event_id in data.events:
		if not CampaignIdentity.valid(event_id):
			return "Campaign economy has an invalid event identity."
		var event = data.events[event_id]
		if (
			not event is Dictionary
			or event.size() != 4
			or not CampaignIdentity.valid(event.get("account_id"))
			or not data.accounts.has(event.account_id)
		):
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
			if (
				posting.source_kind != "event"
				or posting.source_id != event_id
				or posting.source_digest != event.result_digest
			):
				return "Campaign financial posting belongs to another event or result."
			indexed[posting_id] = true
	return ""


static func _accounts_error(
	data: Dictionary, posting_owners: Dictionary, posting_records: Dictionary
) -> String:
	for account_id in data.accounts:
		if not CampaignIdentity.valid(account_id):
			return "Campaign economy has an invalid account identity."
		var account = data.accounts[account_id]
		if (
			not account is Dictionary
			or account.size() != 3
			or not account.get("postings") is Dictionary
			or account.postings.size() > MAX_POSTINGS
		):
			return "Campaign account has an unsupported shape."
		if (
			not RaceCheckpoint.integral(account.get("opening_minor"), -MAX_MINOR, MAX_MINOR)
			or not RaceCheckpoint.integral(account.get("cash_minor"), -MAX_MINOR, MAX_MINOR)
		):
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
	return ""


static func _commitments_error(
	data: Dictionary, posting_owners: Dictionary, posting_records: Dictionary, indexed: Dictionary
) -> String:
	for commitment_id in data.commitments:
		var commitment = data.commitments[commitment_id]
		if not commitment is Dictionary or commitment_id != commitment.get("id"):
			return "Campaign cash commitment key disagrees with its identity."
		var commitment_error = CampaignCashCommitment.validate(commitment)
		if not commitment_error.is_empty():
			return commitment_error
		if (
			not data.accounts.has(commitment.account_id)
			or int(commitment.created_slot) < int(data.authority_from_slot)
		):
			return "Campaign cash commitment account or authority is invalid."
		if commitment.status == "settled":
			var posting_id: String = commitment.settlement_posting_id
			if indexed.has(posting_id) or posting_owners.get(posting_id) != commitment.account_id:
				return "Settled campaign cash commitment has a missing or multiply indexed posting."
			var posting: Dictionary = posting_records[posting_id]
			if (
				posting.source_kind != "commitment"
				or posting.source_id != commitment_id
				or int(posting.slot) != int(commitment.due_slot)
				or int(posting.amount_minor) != int(commitment.amount_minor)
				or posting.category != commitment.category
				or posting.source_digest != commitment.terms_digest
			):
				return "Commitment settlement posting disagrees with its binding terms."
			indexed[posting_id] = true
	return ""
