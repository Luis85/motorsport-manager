class_name CampaignManagement
extends RefCounted
## Stable envelope for management subdomains beyond the engineering foundation.
const KIND = "motorsport-manager-campaign-management"
const VERSION = 1
const MAX_RECORDS = 4096

static func empty(campaign_id: String, organization_id: String,
		authority_from_slot: int = 0) -> Dictionary:
	if not CampaignIdentity.valid(campaign_id) or not CampaignIdentity.valid(organization_id) 			or not RaceCheckpoint.integral(authority_from_slot, 0, CampaignClock.MAX_ELAPSED_SLOTS):
		return {}
	var data = {
		"kind": KIND, "version": VERSION, "campaign_id": campaign_id,
		"organization_id": organization_id, "authority_from_slot": authority_from_slot,
		"commercial": CampaignCommercial.empty(),
		"delegation": {"mandates": {}, "decisions": []},
		"rivals": {"teams": {}, "decision_cycles": []},
		"people": {"plans": {}, "promises": {}},
		"season_planning": {"plans": {}},
		"distress": {"stage": "normal", "history": []}
	}
	_seal(data)
	return data if validate(data).is_empty() else {}

static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign management exceeds serialized-value limits."
	if not data is Dictionary or data.size() != 12 or data.get("kind") != KIND 			or not RaceCheckpoint.integral(data.get("version"), VERSION, VERSION):
		return "Unsupported campaign management projection."
	for key in ["campaign_id", "organization_id"]:
		if not CampaignIdentity.valid(data.get(key)):
			return "Campaign management has an invalid " + key + "."
	if not RaceCheckpoint.integral(data.get("authority_from_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS):
		return "Campaign management has an invalid authority boundary."
	var commercial_error = CampaignCommercial.validate(data.get("commercial"))
	if not commercial_error.is_empty():
		return commercial_error
	var delegation_error = CampaignDelegation.validate(data.get("delegation"))
	if not delegation_error.is_empty():
		return delegation_error
	for key in ["delegation", "rivals", "people", "season_planning", "distress"]:
		if not data.get(key) is Dictionary:
			return "Campaign management has an invalid " + key + " projection."
	if not data.delegation.get("mandates", {}) is Dictionary 			or not data.delegation.get("decisions", []) is Array 			or not data.rivals.get("teams", {}) is Dictionary 			or not data.rivals.get("decision_cycles", []) is Array 			or not data.people.get("plans", {}) is Dictionary 			or not data.people.get("promises", {}) is Dictionary 			or not data.season_planning.get("plans", {}) is Dictionary 			or not data.distress.get("history", []) is Array:
		return "Campaign management subdomain shape is invalid."
	if data.delegation.mandates.size() > MAX_RECORDS or data.delegation.decisions.size() > MAX_RECORDS 			or data.rivals.teams.size() > MAX_RECORDS or data.rivals.decision_cycles.size() > MAX_RECORDS 			or data.people.plans.size() > MAX_RECORDS or data.people.promises.size() > MAX_RECORDS 			or data.season_planning.plans.size() > MAX_RECORDS or data.distress.history.size() > MAX_RECORDS:
		return "Campaign management subdomain collection exceeds its bound."
	if data.distress.get("stage") not in ["normal", "reserve_pressure", "funding_gap", "missed_obligation"]:
		return "Campaign management has an invalid distress stage."
	return _integrity_error(data)

static func with_delegation(current: Dictionary, delegation: Dictionary) -> Dictionary:
	if not validate(current).is_empty() or not CampaignDelegation.validate(delegation).is_empty():
		return {}
	var data = current.duplicate(true)
	data.delegation = delegation.duplicate(true)
	_seal(data)
	return data if validate(data).is_empty() else {}

static func with_commercial(current: Dictionary, commercial: Dictionary) -> Dictionary:
	if not validate(current).is_empty() or not CampaignCommercial.validate(commercial).is_empty():
		return {}
	var data = current.duplicate(true)
	data.commercial = commercial.duplicate(true)
	_seal(data)
	return data if validate(data).is_empty() else {}

static func _integrity_error(data: Dictionary) -> String:
	var content = data.duplicate(true); content.erase("digest")
	if not CampaignIdentity.valid_hash(data.get("digest")) 			or data.digest != RaceStateValue.fingerprint(content):
		return "Campaign management integrity check failed."
	return ""

static func _seal(data: Dictionary) -> void:
	data.erase("digest")
	data["digest"] = RaceStateValue.fingerprint(data)
