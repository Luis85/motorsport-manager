class_name CampaignCheckpoint
extends RefCounted
## Versioned campaign envelope. It stages state, weekend identity and settlement
## evidence together; persistence remains an injected service responsibility.
const KIND = "motorsport-manager-campaign-checkpoint"
const VERSION = 1

static func build(state: CampaignState, settlements: Dictionary = {}, active_manifest: Dictionary = {}) -> Dictionary:
	if state == null:
		return {}
	var ledger = CampaignWeekendSettlement.empty_ledger() if settlements.is_empty() else settlements.duplicate(true)
	var data = {
		"kind": KIND,
		"version": VERSION,
		"campaign_id": state.campaign_id,
		"state": state.snapshot(),
		"settlements": ledger,
		"active_manifest": active_manifest.duplicate(true)
	}
	data["digest"] = RaceStateValue.fingerprint(data)
	return data if validate(data).is_empty() else {}

static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign checkpoint exceeds serialized-value limits."
	if not data is Dictionary or data.size() != 7 or data.get("kind") != KIND:
		return "Unsupported campaign checkpoint."
	if not RaceCheckpoint.integral(data.get("version"), VERSION, VERSION):
		return "Unsupported campaign checkpoint version."
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
	var content = data.duplicate(true)
	content.erase("digest")
	if not CampaignIdentity.valid_hash(data.get("digest")) or data.digest != RaceStateValue.fingerprint(content):
		return "Campaign checkpoint integrity check failed."
	return ""

static func restore(data: Variant) -> Dictionary:
	var error = validate(data)
	if not error.is_empty():
		return {"ok": false, "error": error}
	var state = CampaignState.restore(data.state)
	if state == null:
		return {"ok": false, "error": "Campaign state could not be restored."}
	return {
		"ok": true,
		"error": "",
		"state": state,
		"settlements": data.settlements.duplicate(true),
		"active_manifest": data.active_manifest.duplicate(true)
	}
