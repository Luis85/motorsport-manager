class_name CampaignCashCommitment
extends RefCounted
## Binding future cash movement. Positive amounts are contracted receipts;
## negative amounts are contracted payments. Forecast assumptions stay separate.
const MAX_MINOR = CampaignWeekendPolicy.MAX_MINOR
const STATUSES = ["open", "settled", "cancelled"]
const CATEGORIES = [
	"fixed_operations", "event_operations", "development", "training",
	"facility", "payroll", "supplier", "sponsor", "participation",
	"financing", "other"
]

static func build(input: Dictionary, created_slot: int) -> Dictionary:
	var data = {
		"id": input.get("id"),
		"account_id": input.get("account_id"),
		"source_id": input.get("source_id"),
		"created_slot": created_slot,
		"due_slot": input.get("due_slot"),
		"amount_minor": input.get("amount_minor"),
		"category": input.get("category"),
		"status": "open",
		"resolution_slot": -1,
		"settlement_posting_id": "",
		"terms_digest": ""
	}
	data.terms_digest = terms_digest(data)
	return data if validate(data).is_empty() else {}

static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign cash commitment exceeds serialized-value limits."
	if not data is Dictionary or data.size() != 11:
		return "Campaign cash commitment has an unsupported shape."
	for key in ["id", "account_id", "source_id"]:
		if not CampaignIdentity.valid(data.get(key)):
			return "Campaign cash commitment has an invalid " + key + "."
	if not RaceCheckpoint.integral(data.get("created_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS) \
			or not RaceCheckpoint.integral(data.get("due_slot"), int(data.created_slot), CampaignClock.MAX_ELAPSED_SLOTS):
		return "Campaign cash commitment has invalid timing."
	if not RaceCheckpoint.integral(data.get("amount_minor"), -MAX_MINOR, MAX_MINOR) \
			or int(data.amount_minor) == 0:
		return "Campaign cash commitment has an invalid amount."
	if data.get("category") not in CATEGORIES or data.get("status") not in STATUSES:
		return "Campaign cash commitment has an invalid category or status."
	if not RaceCheckpoint.integral(data.get("resolution_slot"), -1, CampaignClock.MAX_ELAPSED_SLOTS) \
			or not data.get("settlement_posting_id") is String:
		return "Campaign cash commitment has invalid resolution evidence."
	if data.status == "open":
		if int(data.resolution_slot) != -1 or not data.settlement_posting_id.is_empty():
			return "Open campaign cash commitment already has resolution evidence."
	elif data.status == "cancelled":
		if int(data.resolution_slot) < int(data.created_slot) or int(data.resolution_slot) > int(data.due_slot) \
				or not data.settlement_posting_id.is_empty():
			return "Cancelled campaign cash commitment has invalid resolution evidence."
	elif int(data.resolution_slot) != int(data.due_slot) \
			or not CampaignIdentity.valid(data.settlement_posting_id):
		return "Settled campaign cash commitment has invalid posting evidence."
	if not CampaignIdentity.valid_hash(data.get("terms_digest")) \
			or data.terms_digest != terms_digest(data):
		return "Campaign cash commitment terms integrity check failed."
	return ""

static func terms_digest(data: Dictionary) -> String:
	return RaceStateValue.fingerprint({
		"id": data.get("id"),
		"account_id": data.get("account_id"),
		"source_id": data.get("source_id"),
		"created_slot": data.get("created_slot"),
		"due_slot": data.get("due_slot"),
		"amount_minor": data.get("amount_minor"),
		"category": data.get("category")
	})
