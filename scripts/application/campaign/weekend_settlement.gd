class_name CampaignWeekendSettlement
extends RefCounted
## Stages one immutable weekend result into an exactly-once campaign receipt ledger.
## The caller remains responsible for atomically persisting the returned ledger and
## applying competition/economy deltas under its own versioned campaign rules.
const LEDGER_KIND = "motorsport-manager-campaign-weekend-settlements"
const RECEIPT_KIND = "motorsport-manager-campaign-weekend-receipt"
const VERSION = 1
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
		if not CampaignWeekendManifest.valid_stable_id(event_id):
			return "Campaign settlement ledger has an invalid event identity."
		var receipt = data.receipts[event_id]
		var receipt_error = validate_receipt(receipt)
		if not receipt_error.is_empty():
			return receipt_error
		if receipt.campaign_event_id != event_id:
			return "Campaign settlement receipt key and identity disagree."
	var content = data.duplicate(true)
	content.erase("digest")
	if not CampaignWeekendManifest.valid_hash(data.get("digest")) or data.digest != RaceRecord.fingerprint(content):
		return "Campaign settlement ledger integrity check failed."
	return ""

static func validate_receipt(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign settlement receipt exceeds serialized-value limits."
	if not data is Dictionary or data.size() != 14 or data.get("kind") != RECEIPT_KIND:
		return "Unsupported campaign settlement receipt."
	if not RaceCheckpoint.integral(data.get("version"), VERSION, VERSION):
		return "Unsupported campaign settlement receipt version."
	for key in ["campaign_id", "season_id", "campaign_event_id", "entrant_id"]:
		if not CampaignWeekendManifest.valid_stable_id(data.get(key)):
			return "Campaign settlement receipt has an invalid " + key + "."
	if not RaceRecord.valid_id(data.get("race_event_id")):
		return "Campaign settlement receipt has an invalid race identity."
	for key in ["manifest_digest", "result_digest"]:
		if not CampaignWeekendManifest.valid_hash(data.get(key)):
			return "Campaign settlement receipt has an invalid source digest."
	if not data.get("classification") is Array or data.classification.size() < 2 or data.classification.size() > CampaignWeekendManifest.MAX_ENTRANTS:
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
			if not CampaignWeekendManifest.valid_stable_id(row.get(key)):
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
			if not CampaignWeekendManifest.valid_stable_id(row.get(key)):
				return "Campaign returned resources have an invalid stable identity."
		if not people.has(row.person_id) or not RaceCheckpoint.number(row.get("health"), 0, 100) or not RaceCheckpoint.number(row.get("damage"), 0, 100) or not row.get("tyres") is Array:
			return "Campaign returned resources disagree with the classification."
	if not data.get("statistics") is Dictionary or not data.get("provenance") is String or data.provenance.length() > 1000:
		return "Campaign settlement receipt has invalid factual evidence."
	var content = data.duplicate(true)
	content.erase("digest")
	if not CampaignWeekendManifest.valid_hash(data.get("digest")) or data.digest != RaceRecord.fingerprint(content):
		return "Campaign settlement receipt integrity check failed."
	return ""

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
