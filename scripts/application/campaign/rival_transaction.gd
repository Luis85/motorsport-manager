class_name CampaignRivalTransaction
extends RefCounted
## Atomic rival registration/review using only public championship context.

static func register_team(checkpoint: Dictionary, input: Dictionary) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok: return restored
	var changed = CampaignRivals.register_team(
		restored.management.rivals, input, restored.state.clock.elapsed_slots)
	if not changed.ok: return _reject(changed.error, checkpoint)
	var management = _with_rivals(restored.management, changed.rivals)
	if management.is_empty(): return _reject("Rival registration could not update management authority.", checkpoint)
	return _publish(restored, management, "registered", checkpoint)

static func review_due(checkpoint: Dictionary) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok: return restored
	var public_context = _public_context(restored.competition)
	var changed = CampaignRivals.review_due(
		restored.management.rivals, restored.state.clock.elapsed_slots, public_context)
	if not changed.ok: return _reject(changed.error, checkpoint)
	var management = _with_rivals(restored.management, changed.rivals)
	if management.is_empty(): return _reject("Rival review could not update management authority.", checkpoint)
	var result = _publish(restored, management, changed.status, checkpoint)
	if result.ok: result["reviewed"] = changed.reviewed
	return result

static func _public_context(competition: Dictionary) -> Dictionary:
	var positions = {}
	var season_ids = competition.seasons.keys(); season_ids.sort()
	for season_id in season_ids:
		var season: Dictionary = competition.seasons[season_id]
		if season.status in ["planning", "entries_open"]: continue
		for row in season.rankings.teams:
			positions[row.identity] = int(row.position)
	return {"team_positions": positions}

static func _with_rivals(current: Dictionary, rivals: Dictionary) -> Dictionary:
	if not CampaignManagement.validate(current).is_empty() 			or not CampaignRivals.validate(rivals).is_empty():
		return {}
	var data = current.duplicate(true)
	data.rivals = rivals.duplicate(true)
	data.erase("digest"); data["digest"] = RaceStateValue.fingerprint(data)
	return data if CampaignManagement.validate(data).is_empty() else {}

static func _restore(checkpoint: Dictionary) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok: return _reject(restored.error, checkpoint)
	if not restored.active_manifest.is_empty():
		return _reject("Rival campaign reviews are frozen while a weekend is active.", checkpoint)
	return restored

static func _publish(restored: Dictionary, management: Dictionary,
		status: String, original: Dictionary) -> Dictionary:
	var candidate = CampaignCheckpoint.build(restored.state, restored.settlements,
		restored.active_manifest, restored.competition, restored.economy, restored.inventory,
		restored.personnel, restored.operations, restored.engineering, management)
	if candidate.is_empty(): return _reject("Rival change could not form one valid campaign checkpoint.", original)
	return {"ok": true, "status": status, "error": "", "checkpoint": candidate}

static func _reject(message: String, checkpoint: Dictionary) -> Dictionary:
	return {"ok": false, "status": "rejected", "error": message, "checkpoint": checkpoint.duplicate(true)}
