class_name CampaignWeekendPolicy
extends RefCounted
## Versioned competition and event-accounting rules for one campaign weekend.
## The policy is explicit input: the race result never invents points or money.
const KIND = "motorsport-manager-campaign-weekend-policy"
const VERSION = 1
const MAX_ENTRANTS = CampaignWeekendReceipt.MAX_ENTRANTS
const MAX_POINTS = 1000000
const MAX_MINOR = 1000000000000


static func build(
	context: Dictionary,
	points_by_position: Array,
	eligible_people: Array,
	account_people: Array,
	finance: Dictionary
) -> Dictionary:
	if not finance.get("position_bonus_minor", []) is Array:
		return {}
	var data = {
		"kind": KIND,
		"version": VERSION,
		"campaign_id": context.get("campaign_id"),
		"season_id": context.get("season_id"),
		"campaign_event_id": context.get("campaign_event_id"),
		"points_by_position": points_by_position.duplicate(true),
		"eligible_people": eligible_people.duplicate(true),
		"account_id": context.get("account_id"),
		"account_people": account_people.duplicate(true),
		"currency": "credits",
		"entry_cost_minor": finance.get("entry_cost_minor", 0),
		"participation_minor": finance.get("participation_minor", 0),
		"position_bonus_minor": finance.get("position_bonus_minor", []).duplicate(true)
	}
	data["digest"] = RaceStateValue.fingerprint(data)
	return data if validate(data).is_empty() else {}


static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign weekend policy exceeds serialized-value limits."
	if not data is Dictionary or data.size() != 14 or data.get("kind") != KIND:
		return "Unsupported campaign weekend policy."
	if not RaceCheckpoint.integral(data.get("version"), VERSION, VERSION):
		return "Unsupported campaign weekend policy version."
	for key in ["campaign_id", "season_id", "campaign_event_id", "account_id"]:
		if not CampaignIdentity.valid(data.get(key)):
			return "Campaign weekend policy has an invalid " + key + "."
	if data.get("currency") != "credits":
		return "Campaign weekend policy uses an unsupported currency."
	var points_error = _integer_array_error(data.get("points_by_position"), 0, MAX_POINTS, false)
	if not points_error.is_empty():
		return "Campaign points table " + points_error
	var bonus_error = _integer_array_error(data.get("position_bonus_minor"), 0, MAX_MINOR, true)
	if not bonus_error.is_empty():
		return "Campaign position-bonus table " + bonus_error
	if data.position_bonus_minor.size() != data.points_by_position.size():
		return "Campaign points and position-bonus tables must cover the same positions."
	var eligible_error = _identity_array_error(data.get("eligible_people"), true)
	if not eligible_error.is_empty():
		return "Campaign points eligibility " + eligible_error
	var account_error = _identity_array_error(data.get("account_people"), false)
	if not account_error.is_empty():
		return "Campaign account participants " + account_error
	for key in ["entry_cost_minor", "participation_minor"]:
		if not RaceCheckpoint.integral(data.get(key), 0, MAX_MINOR):
			return "Campaign weekend policy has an invalid " + key + "."
	var content = data.duplicate(true)
	content.erase("digest")
	if (
		not CampaignIdentity.valid_hash(data.get("digest"))
		or data.digest != RaceStateValue.fingerprint(content)
	):
		return "Campaign weekend policy integrity check failed."
	return ""


static func receipt_error(policy: Dictionary, receipt: Dictionary) -> String:
	var policy_error = validate(policy)
	if not policy_error.is_empty():
		return policy_error
	var receipt_error = CampaignWeekendReceipt.validate(receipt)
	if not receipt_error.is_empty():
		return receipt_error
	for key in ["campaign_id", "season_id", "campaign_event_id"]:
		if policy[key] != receipt[key]:
			return "Campaign weekend policy does not match the settled " + key + "."
	var people = {}
	for row in receipt.classification:
		people[row.person_id] = true
	for person_id in policy.eligible_people:
		if not people.has(person_id):
			return "Campaign points eligibility references a person outside the weekend."
	for person_id in policy.account_people:
		if not people.has(person_id):
			return "Campaign account participant is outside the weekend."
	return ""


static func points_for(policy: Dictionary, position: int) -> int:
	if position < 1 or position > policy.points_by_position.size():
		return 0
	return int(policy.points_by_position[position - 1])


static func bonus_for(policy: Dictionary, position: int) -> int:
	if position < 1 or position > policy.position_bonus_minor.size():
		return 0
	return int(policy.position_bonus_minor[position - 1])


static func _integer_array_error(value: Variant, low: int, high: int, allow_empty: bool) -> String:
	if not value is Array or value.size() > MAX_ENTRANTS or (value.is_empty() and not allow_empty):
		return "must contain a bounded ordered array."
	for item in value:
		if not RaceCheckpoint.integral(item, low, high):
			return "contains a non-integral or out-of-range value."
	return ""


static func _identity_array_error(value: Variant, allow_empty: bool) -> String:
	if not value is Array or value.size() > MAX_ENTRANTS or (value.is_empty() and not allow_empty):
		return "must contain a bounded identity array."
	var seen = {}
	for identity in value:
		if not CampaignIdentity.valid(identity) or seen.has(identity):
			return "contains an invalid or duplicate identity."
		seen[identity] = true
	return ""
