class_name CampaignCorrectionQuery
extends RefCounted
## Read-only preview of exact replacement deltas before a final-result correction is applied.

static func preview(checkpoint: Dictionary, manifest: Dictionary, result: Dictionary, policy: Dictionary) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok: return {"ok": false, "error": restored.error}
	if not restored.active_manifest.is_empty():
		return {"ok": false, "error": "Correction preview is unavailable during an active weekend."}
	var settlement = CampaignWeekendSettlement.correct(restored.settlements, manifest, result, restored.state.clock.elapsed_slots)
	if not settlement.ok: return {"ok": false, "error": settlement.error}
	if settlement.status == "already_current":
		return {"ok": true, "status": "already_current", "error": "", "cash_delta_minor": 0, "driver_point_deltas": {}, "team_point_deltas": {}, "source_digest": restored.checkpoint.digest}
	var receipt: Dictionary = settlement.receipt
	var competition = CampaignCompetition.correct_event(restored.competition, receipt, policy)
	if not competition.ok: return {"ok": false, "error": competition.error}
	var economy = CampaignEconomy.correct_event(restored.economy, receipt, policy, int(manifest.return_slot))
	if not economy.ok: return {"ok": false, "error": economy.error}
	var inventory = CampaignInventory.correct_event(restored.inventory, receipt, int(manifest.return_slot))
	if not inventory.ok: return {"ok": false, "error": inventory.error}
	var before: Dictionary = restored.competition.seasons[receipt.season_id]
	var after: Dictionary = competition.competition.seasons[receipt.season_id]
	return {"ok": true, "status": "provisional", "error": "",
		"cash_delta_minor": int(economy.economy.accounts[policy.account_id].cash_minor) - int(restored.economy.accounts[policy.account_id].cash_minor),
		"driver_point_deltas": _point_deltas(before.drivers, after.drivers),
		"team_point_deltas": _point_deltas(before.teams, after.teams),
		"inventory_changed": RaceStateValue.fingerprint(inventory.inventory.cars) != RaceStateValue.fingerprint(restored.inventory.cars),
		"previous_result_digest": restored.settlements.receipts[manifest.campaign_event_id].result_digest,
		"result_digest": receipt.result_digest, "source_digest": restored.checkpoint.digest,
		"note": "Provisional replacement deltas only; no standings, cash or inventory changes are persisted until explicit application."}

static func _point_deltas(before: Dictionary, after: Dictionary) -> Dictionary:
	var result = {}
	var ids = before.keys()
	for id in after:
		if id not in ids: ids.append(id)
	ids.sort()
	for id in ids:
		var delta = int(after.get(id, {}).get("points", 0)) - int(before.get(id, {}).get("points", 0))
		if delta != 0: result[id] = delta
	return result