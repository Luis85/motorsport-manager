class_name CampaignCompetitionTransaction
extends RefCounted
## Application boundary for publishing one complete checkpoint after a sporting
## administration change. The active weekend freezes competition administration.

static func register_series(checkpoint: Dictionary, rules: Dictionary) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok:
		return restored
	return _publish(restored, CampaignCompetition.register_series(restored.competition, rules), checkpoint)

static func create_season(checkpoint: Dictionary, definition: Dictionary) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok:
		return restored
	return _publish(restored, CampaignCompetition.create_season(restored.competition, definition), checkpoint)

static func transition_season(checkpoint: Dictionary, season_id: String, target: String) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok:
		return restored
	return _publish(restored,
		CampaignCompetition.transition_season(restored.competition, season_id, target), checkpoint)

static func submit_entry(checkpoint: Dictionary, season_id: String, entry: Dictionary) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok:
		return restored
	return _publish(restored,
		CampaignCompetition.submit_entry(restored.competition, season_id, entry), checkpoint)

static func decide_entry(checkpoint: Dictionary, season_id: String,
		entrant_id: String, accept: bool) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok:
		return restored
	return _publish(restored,
		CampaignCompetition.decide_entry(restored.competition, season_id, entrant_id, accept), checkpoint)

static func withdraw_entry(checkpoint: Dictionary, season_id: String, entrant_id: String) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok:
		return restored
	return _publish(restored,
		CampaignCompetition.withdraw_entry(restored.competition, season_id, entrant_id), checkpoint)

static func cancel_event(checkpoint: Dictionary, season_id: String,
		event_id: String, reason: String) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok:
		return restored
	return _publish(restored,
		CampaignCompetition.cancel_event(restored.competition, season_id, event_id, reason), checkpoint)

static func _restore(checkpoint: Dictionary) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return _reject(restored.error, checkpoint)
	if not restored.active_manifest.is_empty():
		return _reject("Competition administration is frozen while a campaign weekend is active.", checkpoint)
	return restored

static func _publish(restored: Dictionary, changed: Dictionary, original: Dictionary) -> Dictionary:
	if not changed.ok:
		return _reject(changed.error, original, changed.get("status", "rejected"))
	var candidate = CampaignCheckpoint.build(
		restored.state,
		restored.settlements,
		restored.active_manifest,
		changed.competition,
		restored.economy,
		restored.inventory,
		restored.personnel,
		restored.operations,
		restored.engineering,
		restored.management
	)
	if candidate.is_empty():
		return _reject("Competition change could not form one valid campaign checkpoint.", original)
	return {"ok": true, "status": changed.status, "error": "", "checkpoint": candidate}

static func _reject(message: String, checkpoint: Dictionary, status: String = "rejected") -> Dictionary:
	return {"ok": false, "status": status, "error": message,
		"checkpoint": checkpoint.duplicate(true)}
