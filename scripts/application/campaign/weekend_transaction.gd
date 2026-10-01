class_name CampaignWeekendTransaction
extends RefCounted
## Applies one weekend's time, standings, returned resources, event cash and due
## commitments to a detached candidate checkpoint, then publishes all or none.
static func stage(checkpoint: Dictionary, manifest: Dictionary, result: Dictionary, policy: Dictionary) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return _reject(restored.error, checkpoint)
	var settlement = CampaignWeekendSettlement.stage(restored.settlements, manifest, result)
	if not settlement.ok:
		return _reject(settlement.error, checkpoint, settlement.status)
	return _apply(restored, manifest, settlement.ledger, settlement.receipt, settlement.status, policy, checkpoint)

static func stage_receipt(checkpoint: Dictionary, manifest: Dictionary, receipt: Dictionary, policy: Dictionary) -> Dictionary:
	## Recovery/test seam after a receipt has been validated independently.
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return _reject(restored.error, checkpoint)
	var settlement = _stage_receipt(restored.settlements, receipt)
	if not settlement.ok:
		return _reject(settlement.error, checkpoint, settlement.status)
	return _apply(restored, manifest, settlement.ledger, settlement.receipt, settlement.status, policy, checkpoint)

static func _apply(restored: Dictionary, manifest: Dictionary, ledger: Dictionary, receipt: Dictionary,
		settlement_status: String, policy: Dictionary, original: Dictionary) -> Dictionary:
	var manifest_error = CampaignWeekendManifest.validate(manifest)
	if not manifest_error.is_empty():
		return _reject(manifest_error, original)
	var binding_error = _receipt_manifest_error(manifest, receipt)
	if not binding_error.is_empty():
		return _reject(binding_error, original)
	var policy_error = CampaignWeekendPolicy.receipt_error(policy, receipt)
	if not policy_error.is_empty():
		return _reject(policy_error, original)
	if restored.state.campaign_id != manifest.campaign_id or policy.account_id != restored.state.organization_id:
		return _reject("Campaign state, weekend and financial account identities disagree.", original)
	var normalized: Dictionary = restored.checkpoint
	var active: Dictionary = normalized.active_manifest
	if settlement_status == "settled":
		if active.is_empty() or active.digest != manifest.digest:
			return _reject("A new weekend settlement requires the exact active campaign manifest.", original)
		var season_error = CampaignCompetition.manifest_error(normalized.competition, manifest)
		if not season_error.is_empty():
			return _reject(season_error, original)
	elif not active.is_empty() and active.digest != manifest.digest:
		return _reject("Another campaign weekend is active.", original)
	var competition = CampaignCompetition.stage(normalized.competition, receipt, policy)
	if not competition.ok:
		return _reject(competition.error, original, competition.status)
	var inventory = CampaignInventory.stage(normalized.inventory, receipt, int(manifest.return_slot))
	if not inventory.ok:
		return _reject(inventory.error, original, inventory.status)
	var economy = CampaignEconomy.stage(normalized.economy, receipt, policy, int(manifest.return_slot))
	if not economy.ok:
		return _reject(economy.error, original, economy.status)
	var all_applied = competition.status == "already_applied" and inventory.status == "already_applied" \
		and economy.status == "already_applied"
	if settlement_status == "already_settled" and all_applied:
		return {"ok": true, "status": "already_settled", "error": "",
			"checkpoint": normalized.duplicate(true), "receipt": receipt.duplicate(true)}
	var due = CampaignEconomy.settle_due(economy.economy, int(manifest.return_slot))
	if not due.ok:
		return _reject(due.error, original, due.status)
	var state: CampaignState = restored.state
	if state.clock.elapsed_slots != int(manifest.departure_slot):
		return _reject("Campaign time must still equal the frozen departure slot before consequences are applied.", original)
	var elapsed = int(manifest.return_slot) - state.clock.elapsed_slots
	if elapsed <= 0 or not state.command("advance_slots", {"slots": elapsed}):
		return _reject("Campaign return time could not be applied exactly once: " + state.last_error, original)
	var candidate = CampaignCheckpoint.build(
		state, ledger, {}, competition.competition, due.economy,
		inventory.inventory, restored.personnel, restored.operations, restored.engineering)
	if candidate.is_empty():
		return _reject("Weekend consequences could not form one valid campaign checkpoint.", original)
	var status = "settled" if settlement_status == "settled" else "completed_consequences"
	return {"ok": true, "status": status, "error": "", "checkpoint": candidate,
		"receipt": receipt.duplicate(true), "settled_commitments": due.get("settled_count", 0)}

static func _receipt_manifest_error(manifest: Dictionary, receipt: Dictionary) -> String:
	var bindings = [
		["manifest_digest", manifest.digest],
		["campaign_id", manifest.campaign_id],
		["season_id", manifest.season_id],
		["campaign_event_id", manifest.campaign_event_id],
		["entrant_id", manifest.entrant_id],
		["race_event_id", manifest.race_event_id]
	]
	for binding in bindings:
		if receipt.get(binding[0]) != binding[1]:
			return "Campaign receipt does not belong to the supplied immutable weekend manifest."
	var expected = {}
	for mapping in manifest.mappings:
		expected[mapping.person_id] = {"team_id": mapping.team_id, "car_id": mapping.car_id}
	for collection_name in ["classification", "returned_resources"]:
		if not receipt.get(collection_name) is Array or receipt[collection_name].size() != expected.size():
			return "Campaign receipt does not cover every frozen entrant."
		var seen = {}
		for row in receipt[collection_name]:
			if not row is Dictionary or not expected.has(row.get("person_id")) or seen.has(row.person_id):
				return "Campaign receipt has an unknown or repeated stable person identity."
			seen[row.person_id] = true
			var identity: Dictionary = expected[row.person_id]
			if row.get("team_id") != identity.team_id or row.get("car_id") != identity.car_id:
				return "Campaign receipt stable identity mapping differs from the frozen manifest."
	return ""

static func _stage_receipt(ledger: Dictionary, receipt: Dictionary) -> Dictionary:
	var receipt_error = CampaignWeekendSettlement.validate_receipt(receipt)
	if not receipt_error.is_empty():
		return {"ok": false, "status": "rejected", "error": receipt_error}
	var current = CampaignWeekendSettlement.empty_ledger() if ledger.is_empty() else ledger.duplicate(true)
	var ledger_error = CampaignWeekendSettlement.validate_ledger(current)
	if not ledger_error.is_empty():
		return {"ok": false, "status": "rejected", "error": ledger_error}
	var event_id: String = receipt.campaign_event_id
	if current.receipts.has(event_id):
		var previous: Dictionary = current.receipts[event_id]
		if previous.manifest_digest == receipt.manifest_digest and previous.result_digest == receipt.result_digest:
			return {"ok": true, "status": "already_settled", "ledger": current, "receipt": previous.duplicate(true)}
		return {"ok": false, "status": "conflict", "error": "This campaign event already has a different settled receipt."}
	if current.receipts.size() >= CampaignWeekendSettlement.MAX_RECEIPTS:
		return {"ok": false, "status": "rejected", "error": "The campaign settlement ledger is full."}
	current.receipts[event_id] = receipt.duplicate(true)
	current.erase("digest")
	current["digest"] = RaceStateValue.fingerprint(current)
	return {"ok": true, "status": "settled", "ledger": current, "receipt": receipt.duplicate(true)}

static func _reject(message: String, checkpoint: Dictionary, status: String = "rejected") -> Dictionary:
	return {"ok": false, "status": status, "error": message, "checkpoint": checkpoint.duplicate(true)}
