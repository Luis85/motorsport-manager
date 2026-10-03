class_name CampaignDirectorTransaction
extends RefCounted
## Explicit campaign-time progression for the Director Desk. Due obligations and
## rival reviews publish in the same complete checkpoint candidate.


static func advance_to_next_event(checkpoint: Dictionary) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return _reject(restored.error, checkpoint)
	if not restored.active_manifest.is_empty():
		return _reject("Campaign time cannot advance while a weekend is active.", checkpoint)
	var event = _next_event(restored.competition)
	if event.is_empty():
		return _reject("There is no scheduled event to advance toward.", checkpoint)
	var target = int(event.departure_slot)
	var current = restored.state.clock.elapsed_slots
	if target < current:
		return _reject("The next event departure is already in the past.", checkpoint)
	if target == current:
		return {
			"ok": true, "status": "ready", "error": "", "checkpoint": checkpoint.duplicate(true)
		}
	var state: CampaignState = restored.state
	if not state.command("advance_slots", {"slots": target - current}):
		return _reject(state.last_error, checkpoint)
	var due = CampaignEconomy.settle_due(restored.economy, target)
	if not due.ok:
		return _reject(due.error, checkpoint)
	var rivals = CampaignRivals.review_due(
		restored.management.rivals, target, _public_context(restored.competition)
	)
	if not rivals.ok:
		return _reject(rivals.error, checkpoint)
	var management = CampaignManagement.with_rivals(restored.management, rivals.rivals)
	if management.is_empty():
		return _reject("Rival review could not update management state.", checkpoint)
	var candidate = CampaignCheckpoint.build(
		state,
		restored.settlements,
		{},
		restored.competition,
		due.economy,
		restored.inventory,
		restored.personnel,
		restored.operations,
		restored.engineering,
		management
	)
	if candidate.is_empty():
		return _reject("Advance could not form one valid campaign checkpoint.", checkpoint)
	return {
		"ok": true,
		"status": "advanced",
		"error": "",
		"checkpoint": candidate,
		"settled_commitments": due.get("settled_count", 0),
		"rivals_reviewed": rivals.reviewed
	}


static func after_weekend(checkpoint: Dictionary) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return _reject(restored.error, checkpoint)
	if not restored.active_manifest.is_empty():
		return _reject("Weekend follow-up requires a settled campaign event.", checkpoint)
	var rivals = CampaignRivals.review_due(
		restored.management.rivals,
		restored.state.clock.elapsed_slots,
		_public_context(restored.competition)
	)
	if not rivals.ok:
		return _reject(rivals.error, checkpoint)
	var management = CampaignManagement.with_rivals(restored.management, rivals.rivals)
	if management.is_empty():
		return _reject("Rival follow-up could not update management state.", checkpoint)
	var competition = restored.competition
	var season = _active_season(competition)
	if (
		not season.is_empty()
		and season.status == "active"
		and CampaignSeason.next_scheduled_event_id(season).is_empty()
	):
		for target in ["final_classification", "settled", "contract_transition", "completed"]:
			var changed = CampaignCompetition.transition_season(
				competition, season.season_id, target
			)
			if not changed.ok:
				return _reject(changed.error, checkpoint)
			competition = changed.competition
	var candidate = CampaignCheckpoint.build(
		restored.state,
		restored.settlements,
		{},
		competition,
		restored.economy,
		restored.inventory,
		restored.personnel,
		restored.operations,
		restored.engineering,
		management
	)
	if candidate.is_empty():
		return _reject(
			"Weekend follow-up could not form one valid campaign checkpoint.", checkpoint
		)
	return {
		"ok": true,
		"status": "updated",
		"error": "",
		"checkpoint": candidate,
		"rivals_reviewed": rivals.reviewed
	}


static func _next_event(competition: Dictionary) -> Dictionary:
	var season = _active_season(competition)
	if season.is_empty():
		return {}
	var event_id = CampaignSeason.next_scheduled_event_id(season)
	return CampaignSeason.calendar_event(season, event_id) if not event_id.is_empty() else {}


static func _active_season(competition: Dictionary) -> Dictionary:
	var ids = competition.seasons.keys()
	ids.sort()
	for season_id in ids:
		var season: Dictionary = competition.seasons[season_id]
		if season.status == "active":
			return season
	return {}


static func _public_context(competition: Dictionary) -> Dictionary:
	var positions = {}
	var season = _active_season(competition)
	if not season.is_empty():
		for row in season.rankings.teams:
			positions[row.identity] = int(row.position)
	return {"team_positions": positions}


static func _reject(message: String, checkpoint: Dictionary) -> Dictionary:
	return {
		"ok": false,
		"status": "rejected",
		"error": message,
		"checkpoint": checkpoint.duplicate(true)
	}
