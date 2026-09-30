class_name CampaignWeekendSettlement
extends RefCounted
## Stages one immutable weekend result into an exactly-once campaign receipt ledger.
## The caller remains responsible for atomically persisting the returned ledger and
## applying competition/economy deltas under its own versioned campaign rules.
const LEDGER_KIND = "motorsport-manager-campaign-weekend-settlements"
const RECEIPT_KIND = CampaignWeekendReceipt.KIND
const VERSION = CampaignWeekendReceipt.VERSION
const MAX_RECEIPTS = 1024

static func empty_ledger() -> Dictionary:
	var ledger = {"kind": LEDGER_KIND, "version": VERSION, "receipts": {}}
	ledger["digest"] = RaceRecord.fingerprint(ledger)
	return ledger

static func stage(ledger: Dictionary, manifest: Dictionary, result: Dictionary) -> Dictionary:
	var manifest_error = CampaignWeekendManifest.validate(manifest)
	if not manifest_error.is_empty():
		return {"ok": false, "status": "rejected", "error": manifest_error}
	var result_error = WeekendResult.validate(result)
	if not result_error.is_empty():
		return {"ok": false, "status": "rejected", "error": result_error}
	var contract_error = _contract_error(manifest, result)
	if not contract_error.is_empty():
		return {"ok": false, "status": "rejected", "error": contract_error}
	var current = empty_ledger() if ledger.is_empty() else ledger.duplicate(true)
	var ledger_error = validate_ledger(current)
	if not ledger_error.is_empty():
		return {"ok": false, "status": "rejected", "error": ledger_error}
	var event_id: String = manifest.campaign_event_id
	if current.receipts.has(event_id):
		var previous: Dictionary = current.receipts[event_id]
		if previous.manifest_digest == manifest.digest and previous.result_digest == result.digest:
			return {"ok": true, "status": "already_settled", "ledger": current,
				"receipt": previous.duplicate(true)}
		return {"ok": false, "status": "conflict",
			"error": "This campaign event already has a different settled result. Use an explicit correction workflow; no second settlement was staged."}
	if current.receipts.size() >= MAX_RECEIPTS:
		return {"ok": false, "status": "rejected", "error": "The campaign settlement ledger is full; no existing receipt was removed."}
	var receipt = _build_receipt(manifest, result)
	var receipt_error = validate_receipt(receipt)
	if not receipt_error.is_empty():
		return {"ok": false, "status": "rejected", "error": receipt_error}
	current.receipts[event_id] = receipt.duplicate(true)
	current.erase("digest")
	current["digest"] = RaceRecord.fingerprint(current)
	return {"ok": true, "status": "settled", "ledger": current,
		"receipt": receipt.duplicate(true)}

static func validate_ledger(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign settlement ledger exceeds serialized-value limits."
	if not data is Dictionary or data.size() != 4 or data.get("kind") != LEDGER_KIND:
		return "Unsupported campaign settlement ledger."
	if not RaceCheckpoint.integral(data.get("version"), VERSION, VERSION) or not data.get("receipts") is Dictionary:
		return "Invalid campaign settlement ledger version or collection."
	if data.receipts.size() > MAX_RECEIPTS:
		return "Campaign settlement ledger exceeds its receipt limit."
	for event_id in data.receipts:
		if not CampaignIdentity.valid(event_id):
			return "Campaign settlement ledger has an invalid event identity."
		var receipt = data.receipts[event_id]
		var receipt_error = validate_receipt(receipt)
		if not receipt_error.is_empty():
			return receipt_error
		if receipt.campaign_event_id != event_id:
			return "Campaign settlement receipt key and identity disagree."
	var content = data.duplicate(true)
	content.erase("digest")
	if not CampaignIdentity.valid_hash(data.get("digest")) or data.digest != RaceRecord.fingerprint(content):
		return "Campaign settlement ledger integrity check failed."
	return ""

static func validate_receipt(data: Variant) -> String:
	return CampaignWeekendReceipt.validate(data)

static func _contract_error(manifest: Dictionary, result: Dictionary) -> String:
	if result.origin == "sandbox":
		return "Sandbox results cannot settle a campaign event."
	if result.event_id != manifest.race_event_id:
		return "Weekend result does not belong to the frozen campaign entry."
	if result.model != manifest.race_model or int(result.checkpoint_version) != int(manifest.checkpoint_version):
		return "Weekend result model differs from the frozen campaign entry."
	if result.track_hash != manifest.track_hash or result.roster_hash != manifest.roster_hash:
		return "Weekend result track or roster differs from the frozen campaign entry."
	if RaceRecord.fingerprint(result.ruleset) != manifest.ruleset_hash:
		return "Weekend result rules differ from the frozen campaign entry."
	if result.classification.size() != manifest.mappings.size() or result.returned_resources.size() != manifest.mappings.size():
		return "Weekend result does not account for every frozen campaign entrant."
	return ""

static func _build_receipt(manifest: Dictionary, result: Dictionary) -> Dictionary:
	var mappings = {}
	for row in manifest.mappings:
		mappings[int(row.race_id)] = row
	var classification: Array = []
	for row in result.classification:
		var converted = row.duplicate(true)
		var mapping: Dictionary = mappings[int(converted.driver_id)]
		converted.erase("driver_id")
		converted["person_id"] = mapping.person_id
		converted["team_id"] = mapping.team_id
		converted["car_id"] = mapping.car_id
		classification.append(converted)
	var returned_resources: Array = []
	for row in result.returned_resources:
		var converted = row.duplicate(true)
		var mapping: Dictionary = mappings[int(converted.driver_id)]
		converted.erase("driver_id")
		converted["person_id"] = mapping.person_id
		converted["team_id"] = mapping.team_id
		converted["car_id"] = mapping.car_id
		returned_resources.append(converted)
	var receipt = {
		"kind": RECEIPT_KIND,
		"version": VERSION,
		"campaign_id": manifest.campaign_id,
		"season_id": manifest.season_id,
		"campaign_event_id": manifest.campaign_event_id,
		"entrant_id": manifest.entrant_id,
		"race_event_id": manifest.race_event_id,
		"manifest_digest": manifest.digest,
		"result_digest": result.digest,
		"classification": classification,
		"returned_resources": returned_resources,
		"statistics": result.statistics.duplicate(true),
		"provenance": "Mapped measured weekend facts to stable campaign identities. No points, cash, XP or component diagnosis was inferred."
	}
	receipt["digest"] = RaceRecord.fingerprint(receipt)
	return receipt
