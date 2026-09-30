class_name CampaignWeekendReceipt
extends RefCounted
## Domain-level shape and integrity contract for one factual campaign receipt.
## Application settlement builds the record; projections may validate it inward.
const KIND = "motorsport-manager-campaign-weekend-receipt"
const VERSION = 1
const MAX_ENTRANTS = 64

static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign settlement receipt exceeds serialized-value limits."
	if not data is Dictionary or data.size() != 14 or data.get("kind") != KIND:
		return "Unsupported campaign settlement receipt."
	if not RaceCheckpoint.integral(data.get("version"), VERSION, VERSION):
		return "Unsupported campaign settlement receipt version."
	for key in ["campaign_id", "season_id", "campaign_event_id", "entrant_id"]:
		if not CampaignIdentity.valid(data.get(key)):
			return "Campaign settlement receipt has an invalid " + key + "."
	if not valid_race_id(data.get("race_event_id")):
		return "Campaign settlement receipt has an invalid race identity."
	for key in ["manifest_digest", "result_digest"]:
		if not CampaignIdentity.valid_hash(data.get(key)):
			return "Campaign settlement receipt has an invalid source digest."
	if not data.get("classification") is Array or data.classification.size() < 2 or data.classification.size() > MAX_ENTRANTS:
		return "Campaign settlement receipt has an invalid classification."
	if not data.get("returned_resources") is Array or data.returned_resources.size() != data.classification.size():
		return "Campaign settlement receipt has incomplete returned resources."
	var people = {}
	for index in range(data.classification.size()):
		var row = data.classification[index]
		if not row is Dictionary or row.size() != 10 or row.has("driver_id"):
			return "Campaign classification row has an unsupported shape."
		if not RaceCheckpoint.integral(row.get("position"), index + 1, index + 1):
			return "Campaign classification ordering is invalid."
		for key in ["person_id", "team_id", "car_id"]:
			if not CampaignIdentity.valid(row.get(key)):
				return "Campaign classification has an invalid stable identity."
		if people.has(row.person_id):
			return "Campaign classification repeats a person identity."
		people[row.person_id] = true
		if row.get("points_eligibility") != "not_defined_by_standalone_rules":
			return "Campaign settlement must not invent standalone points eligibility."
	for row in data.returned_resources:
		if not row is Dictionary or row.size() != 6 or row.has("driver_id"):
			return "Campaign returned-resource row has an unsupported shape."
		for key in ["person_id", "team_id", "car_id"]:
			if not CampaignIdentity.valid(row.get(key)):
				return "Campaign returned resources have an invalid stable identity."
		if not people.has(row.person_id) or not RaceCheckpoint.number(row.get("health"), 0, 100) \
				or not RaceCheckpoint.number(row.get("damage"), 0, 100) or not row.get("tyres") is Array:
			return "Campaign returned resources disagree with the classification."
	if not data.get("statistics") is Dictionary or not data.get("provenance") is String or data.provenance.length() > 1000:
		return "Campaign settlement receipt has invalid factual evidence."
	var content = data.duplicate(true)
	content.erase("digest")
	if not CampaignIdentity.valid_hash(data.get("digest")) or data.digest != RaceStateValue.fingerprint(content):
		return "Campaign settlement receipt integrity check failed."
	return ""

static func valid_race_id(value: Variant) -> bool:
	if not value is String or value.length() != 36:
		return false
	for index in [8, 13, 18, 23]:
		if value.substr(index, 1) != "-":
			return false
	var compact = value.replace("-", "")
	return compact.length() == 32 and compact.is_valid_hex_number(false)
