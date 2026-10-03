class_name CampaignWeekendSettlement
extends RefCounted
## Stages one immutable weekend result into an exactly-once campaign receipt ledger.
## The caller remains responsible for atomically persisting the returned ledger and
## applying competition/economy deltas under its own versioned campaign rules.
const LEDGER_KIND = "motorsport-manager-campaign-weekend-settlements"
const RECEIPT_KIND = CampaignWeekendReceipt.KIND
const VERSION = CampaignWeekendReceipt.VERSION
const LEDGER_VERSION = 2
const LEGACY_LEDGER_VERSION = 1
const MAX_RECEIPTS = 1024
const MAX_CORRECTIONS = 1024


static func empty_ledger() -> Dictionary:
	var ledger = {"kind": LEDGER_KIND, "version": LEDGER_VERSION, "receipts": {}, "corrections": []}
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
			return {
				"ok": true,
				"status": "already_settled",
				"ledger": current,
				"receipt": previous.duplicate(true)
			}
		return {
			"ok": false,
			"status": "conflict",
			"error":
			(
				"This campaign event already has a different settled result. Use an explicit "
				+ "correction workflow; no second settlement was staged."
			)
		}
	if current.receipts.size() >= MAX_RECEIPTS:
		return {
			"ok": false,
			"status": "rejected",
			"error": "The campaign settlement ledger is full; no existing receipt was removed."
		}
	var receipt = _build_receipt(manifest, result)
	var receipt_error = validate_receipt(receipt)
	if not receipt_error.is_empty():
		return {"ok": false, "status": "rejected", "error": receipt_error}
	current.receipts[event_id] = receipt.duplicate(true)
	current.erase("digest")
	current["digest"] = RaceRecord.fingerprint(current)
	return {"ok": true, "status": "settled", "ledger": current, "receipt": receipt.duplicate(true)}


static func correct(
	ledger: Dictionary, manifest: Dictionary, result: Dictionary, correction_slot: int
) -> Dictionary:
	var manifest_error = CampaignWeekendManifest.validate(manifest)
	if not manifest_error.is_empty():
		return {"ok": false, "status": "rejected", "error": manifest_error}
	var result_error = WeekendResult.validate(result)
	if not result_error.is_empty():
		return {"ok": false, "status": "rejected", "error": result_error}
	var contract_error = _contract_error(manifest, result)
	if not contract_error.is_empty():
		return {"ok": false, "status": "rejected", "error": contract_error}
	if not RaceCheckpoint.integral(
		correction_slot, int(manifest.return_slot), CampaignClock.MAX_ELAPSED_SLOTS
	):
		return {
			"ok": false,
			"status": "rejected",
			"error": "Campaign correction is dated before the original return."
		}
	var current = _upgrade_ledger(ledger)
	var ledger_error = validate_ledger(current)
	if not ledger_error.is_empty():
		return {"ok": false, "status": "rejected", "error": ledger_error}
	var event_id: String = manifest.campaign_event_id
	if not current.receipts.has(event_id):
		return {
			"ok": false,
			"status": "rejected",
			"error": "Campaign correction requires an existing settled receipt."
		}
	var previous: Dictionary = current.receipts[event_id]
	if previous.manifest_digest != manifest.digest:
		return {
			"ok": false,
			"status": "rejected",
			"error": "Campaign correction must use the original frozen manifest."
		}
	if previous.result_digest == result.digest:
		return {
			"ok": true,
			"status": "already_current",
			"ledger": current,
			"receipt": previous.duplicate(true)
		}
	if current.corrections.size() >= MAX_CORRECTIONS:
		return {"ok": false, "status": "rejected", "error": "Campaign correction journal is full."}
	var receipt = _build_receipt(manifest, result)
	var receipt_error = validate_receipt(receipt)
	if not receipt_error.is_empty():
		return {"ok": false, "status": "rejected", "error": receipt_error}
	var row = {
		"id":
		(
			"correction."
			+ (
				RaceStateValue
				. fingerprint([event_id, previous.result_digest, result.digest, correction_slot])
				. substr(0, 24)
			)
		),
		"campaign_event_id": event_id,
		"slot": correction_slot,
		"previous_result_digest": previous.result_digest,
		"result_digest": result.digest,
		"manifest_digest": manifest.digest
	}
	row["digest"] = RaceStateValue.fingerprint(row)
	current.receipts[event_id] = receipt.duplicate(true)
	current.corrections.append(row)
	current.erase("digest")
	current["digest"] = RaceStateValue.fingerprint(current)
	ledger_error = validate_ledger(current)
	return {
		"ok": ledger_error.is_empty(),
		"status": "corrected" if ledger_error.is_empty() else "rejected",
		"error": ledger_error,
		"ledger": current if ledger_error.is_empty() else ledger.duplicate(true),
		"receipt": receipt.duplicate(true),
		"correction": row.duplicate(true)
	}


static func _upgrade_ledger(ledger: Dictionary) -> Dictionary:
	if ledger.is_empty():
		return empty_ledger()
	var current = ledger.duplicate(true)
	if (
		RaceCheckpoint.integral(
			current.get("version"), LEGACY_LEDGER_VERSION, LEGACY_LEDGER_VERSION
		)
		and current.size() == 4
		and current.get("kind") == LEDGER_KIND
	):
		current.version = LEDGER_VERSION
		current["corrections"] = []
		current.erase("digest")
		current["digest"] = RaceStateValue.fingerprint(current)
	return current


static func validate_ledger(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign settlement ledger exceeds serialized-value limits."
	if not data is Dictionary or data.get("kind") != LEDGER_KIND:
		return "Unsupported campaign settlement ledger."
	var legacy = RaceCheckpoint.integral(
		data.get("version"), LEGACY_LEDGER_VERSION, LEGACY_LEDGER_VERSION
	)
	var current = RaceCheckpoint.integral(data.get("version"), LEDGER_VERSION, LEDGER_VERSION)
	if (
		(legacy and data.size() != 4)
		or (current and data.size() != 5)
		or (not legacy and not current)
		or not data.get("receipts") is Dictionary
	):
		return "Invalid campaign settlement ledger version or collection."
	if (
		current
		and (not data.get("corrections") is Array or data.corrections.size() > MAX_CORRECTIONS)
	):
		return "Campaign correction journal is invalid."
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
	var corrections_error = _corrections_error(data, current)
	if not corrections_error.is_empty():
		return corrections_error
	var content = data.duplicate(true)
	content.erase("digest")
	if (
		not CampaignIdentity.valid_hash(data.get("digest"))
		or data.digest != RaceRecord.fingerprint(content)
	):
		return "Campaign settlement ledger integrity check failed."
	return ""


static func validate_receipt(data: Variant) -> String:
	return CampaignWeekendReceipt.validate(data)


static func _contract_error(manifest: Dictionary, result: Dictionary) -> String:
	if result.origin == "sandbox":
		return "Sandbox results cannot settle a campaign event."
	if result.event_id != manifest.race_event_id:
		return "Weekend result does not belong to the frozen campaign entry."
	if (
		result.model != manifest.race_model
		or int(result.checkpoint_version) != int(manifest.checkpoint_version)
	):
		return "Weekend result model differs from the frozen campaign entry."
	if result.track_hash != manifest.track_hash or result.roster_hash != manifest.roster_hash:
		return "Weekend result track or roster differs from the frozen campaign entry."
	if RaceRecord.fingerprint(result.ruleset) != manifest.ruleset_hash:
		return "Weekend result rules differ from the frozen campaign entry."
	if (
		result.classification.size() != manifest.mappings.size()
		or result.returned_resources.size() != manifest.mappings.size()
	):
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
		"provenance":
		(
			"Mapped measured weekend facts to stable campaign identities. No points, cash, "
			+ "XP or component diagnosis was inferred."
		)
	}
	receipt["digest"] = RaceRecord.fingerprint(receipt)
	return receipt


static func _corrections_error(data: Dictionary, current: bool) -> String:
	if current:
		var correction_ids = {}
		for row in data.corrections:
			if (
				not row is Dictionary
				or row.size() != 7
				or not CampaignIdentity.valid(row.get("id"))
				or correction_ids.has(row.id)
				or not data.receipts.has(row.get("campaign_event_id"))
				or not RaceCheckpoint.integral(row.get("slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS)
			):
				return "Campaign correction journal contains invalid identity or timing."
			for key in ["previous_result_digest", "result_digest", "manifest_digest"]:
				if not CampaignIdentity.valid_hash(row.get(key)):
					return "Campaign correction journal contains invalid evidence."
			var row_content = row.duplicate(true)
			row_content.erase("digest")
			if (
				not CampaignIdentity.valid_hash(row.get("digest"))
				or row.digest != RaceStateValue.fingerprint(row_content)
			):
				return "Campaign correction journal integrity check failed."
			correction_ids[row.id] = true
	return ""
