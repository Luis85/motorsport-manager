class_name CampaignCheckpoint
extends RefCounted
## Versioned campaign envelope. State, factual receipts and derived projections are
## published together; persistence remains an injected service responsibility.
const KIND = "motorsport-manager-campaign-checkpoint"
const VERSION = 2
const LEGACY_VERSION = 1

static func build(state: CampaignState, settlements: Dictionary = {}, active_manifest: Dictionary = {},
		competition: Dictionary = {}, economy: Dictionary = {}, inventory: Dictionary = {}) -> Dictionary:
	if state == null:
		return {}
	var ledger = CampaignWeekendSettlement.empty_ledger() if settlements.is_empty() else settlements.duplicate(true)
	var sporting = CampaignCompetition.empty(state.campaign_id) if competition.is_empty() else competition.duplicate(true)
	var accounts = CampaignEconomy.create(state.campaign_id, state.organization_id, 0) if economy.is_empty() else economy.duplicate(true)
	var resources = CampaignInventory.empty(state.campaign_id) if inventory.is_empty() else inventory.duplicate(true)
	var data = {
		"kind": KIND,
		"version": VERSION,
		"campaign_id": state.campaign_id,
		"state": state.snapshot(),
		"settlements": ledger,
		"active_manifest": active_manifest.duplicate(true),
		"competition": sporting,
		"economy": accounts,
		"inventory": resources
	}
	data["digest"] = RaceStateValue.fingerprint(data)
	return data if validate(data).is_empty() else {}

static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign checkpoint exceeds serialized-value limits."
	if not data is Dictionary or data.get("kind") != KIND:
		return "Unsupported campaign checkpoint."
	if RaceCheckpoint.integral(data.get("version"), LEGACY_VERSION, LEGACY_VERSION):
		return _validate_legacy(data)
	if not RaceCheckpoint.integral(data.get("version"), VERSION, VERSION) or data.size() != 10:
		return "Unsupported campaign checkpoint version."
	var shared_error = _shared_error(data)
	if not shared_error.is_empty():
		return shared_error
	var projection_errors = [
		CampaignCompetition.validate(data.get("competition")),
		CampaignEconomy.validate(data.get("economy")),
		CampaignInventory.validate(data.get("inventory"))
	]
	for error in projection_errors:
		if not error.is_empty():
			return error
	for projection_key in ["competition", "economy", "inventory"]:
		if data[projection_key].campaign_id != data.campaign_id:
			return "Campaign " + projection_key + " belongs to a different campaign."
	if not data.economy.accounts.has(data.state.organization_id):
		return "Campaign economy does not contain the organization's account."
	if not _same_event_keys(data.competition.events, data.economy.events) \
			or not _same_event_keys(data.competition.events, data.inventory.events):
		return "Campaign consequence projections must contain the same complete event set."
	var projection_error = ""
	for event_id in data.competition.events:
		projection_error = _projection_event_error(data, event_id, data.competition.events[event_id].result_digest)
		if not projection_error.is_empty():
			return projection_error
		if data.economy.events[event_id].policy_digest != data.competition.events[event_id].policy_digest:
			return "Campaign sporting and financial consequences use different policies."
	return _digest_error(data)

static func restore(data: Variant) -> Dictionary:
	var normalized = upgrade(data)
	if normalized.is_empty():
		return {"ok": false, "error": validate(data)}
	var state = CampaignState.restore(normalized.state)
	if state == null:
		return {"ok": false, "error": "Campaign state could not be restored."}
	return {
		"ok": true,
		"error": "",
		"state": state,
		"settlements": normalized.settlements.duplicate(true),
		"active_manifest": normalized.active_manifest.duplicate(true),
		"competition": normalized.competition.duplicate(true),
		"economy": normalized.economy.duplicate(true),
		"inventory": normalized.inventory.duplicate(true),
		"checkpoint": normalized.duplicate(true)
	}

static func upgrade(data: Variant) -> Dictionary:
	var error = validate(data)
	if not error.is_empty():
		return {}
	if int(data.version) == VERSION:
		return data.duplicate(true)
	var state = CampaignState.restore(data.state)
	if state == null:
		return {}
	return build(state, data.settlements, data.active_manifest)

static func _validate_legacy(data: Dictionary) -> String:
	if data.size() != 7:
		return "Unsupported legacy campaign checkpoint."
	var error = _shared_error(data)
	if not error.is_empty():
		return error
	return _digest_error(data)

static func _shared_error(data: Dictionary) -> String:
	if not CampaignIdentity.valid(data.get("campaign_id")):
		return "Campaign checkpoint has an invalid identity."
	var state_error = CampaignState.validate(data.get("state"))
	if not state_error.is_empty():
		return state_error
	if data.state.campaign_id != data.campaign_id:
		return "Campaign checkpoint identity disagrees with its state."
	var ledger_error = CampaignWeekendSettlement.validate_ledger(data.get("settlements"))
	if not ledger_error.is_empty():
		return ledger_error
	for event_id in data.settlements.receipts:
		if data.settlements.receipts[event_id].campaign_id != data.campaign_id:
			return "Campaign settlement belongs to a different campaign."
	if not data.get("active_manifest") is Dictionary:
		return "Campaign checkpoint has an invalid active weekend reference."
	if not data.active_manifest.is_empty():
		var manifest_error = CampaignWeekendManifest.validate(data.active_manifest)
		if not manifest_error.is_empty():
			return manifest_error
		if data.active_manifest.campaign_id != data.campaign_id:
			return "Active weekend belongs to a different campaign."
		if data.settlements.receipts.has(data.active_manifest.campaign_event_id):
			return "A settled campaign event cannot remain active."
	return ""

static func _projection_event_error(data: Dictionary, event_id: String, result_digest: String) -> String:
	if not data.settlements.receipts.has(event_id):
		return "Campaign consequence references an unsettled event."
	if data.settlements.receipts[event_id].result_digest != result_digest:
		return "Campaign consequence result digest disagrees with its factual receipt."
	return ""

static func _same_event_keys(left: Dictionary, right: Dictionary) -> bool:
	var left_keys = left.keys()
	var right_keys = right.keys()
	left_keys.sort()
	right_keys.sort()
	return left_keys == right_keys

static func _digest_error(data: Dictionary) -> String:
	var content = data.duplicate(true)
	content.erase("digest")
	if not CampaignIdentity.valid_hash(data.get("digest")) or data.digest != RaceStateValue.fingerprint(content):
		return "Campaign checkpoint integrity check failed."
	return ""
