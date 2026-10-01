class_name CampaignSeasonProgressionTransaction
extends RefCounted
## TM-14 future-car planning, promotion choice, season prize and next-season creation.

static func set_plan(checkpoint: Dictionary, input: Dictionary) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok: return restored
	if not restored.competition.seasons.has(input.get("season_id")):
		return _reject("Season plan references an unknown season.", checkpoint)
	var data = input.duplicate(true); data["id"] = input.get("season_id")
	var changed = CampaignSeasonPlanning.set_plan(restored.management.season_planning,
		data, restored.state.clock.elapsed_slots)
	return _publish_planning(restored, changed, restored.economy, restored.competition, checkpoint)

static func offer_promotion(checkpoint: Dictionary, source_season_id: String,
		target_series_id: String, deadline_slot: int, minimum_cash_minor: int) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok: return restored
	if not restored.competition.seasons.has(source_season_id) 			or restored.competition.seasons[source_season_id].status != "completed":
		return _reject("Promotion can be offered only after a completed season.", checkpoint)
	var changed = CampaignSeasonPlanning.offer_promotion(restored.management.season_planning, {
		"id": "promotion." + source_season_id, "source_season_id": source_season_id,
		"target_series_id": target_series_id, "deadline_slot": deadline_slot,
		"minimum_cash_minor": minimum_cash_minor}, restored.state.clock.elapsed_slots)
	return _publish_planning(restored, changed, restored.economy, restored.competition, checkpoint)

static func decide_promotion(checkpoint: Dictionary, offer_id: String, accept: bool) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok: return restored
	var cash = int(restored.economy.accounts[restored.state.organization_id].cash_minor)
	var changed = CampaignSeasonPlanning.decide_promotion(restored.management.season_planning,
		offer_id, accept, restored.state.clock.elapsed_slots, cash)
	return _publish_planning(restored, changed, restored.economy, restored.competition, checkpoint)

static func begin_next_season(checkpoint: Dictionary, source_season_id: String,
		next_definition: Dictionary, target_rules: Dictionary, decision: String,
		prize_minor: int) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok: return restored
	if decision not in CampaignSeasonPlanning.DECISIONS 			or not restored.competition.seasons.has(source_season_id):
		return _reject("Next-season decision or source season is invalid.", checkpoint)
	var source: Dictionary = restored.competition.seasons[source_season_id]
	if source.status != "completed":
		return _reject("Next season requires a completed source season.", checkpoint)
	if not CampaignSeriesRules.validate(target_rules).is_empty() 			or next_definition.get("series_id") != target_rules.series_id 			or not next_definition.get("calendar") is Array or next_definition.calendar.size() != 8:
		return _reject("Next season requires one valid eight-event frozen rule pack.", checkpoint)
	if decision == "promote":
		var promotion_id = "promotion." + source_season_id
		var offer = restored.management.season_planning.promotion_offers.get(promotion_id, {})
		if offer.is_empty() or offer.status != "accepted" or offer.target_series_id != target_rules.series_id:
			return _reject("Promotion requires an accepted matching offer.", checkpoint)
	var competition = restored.competition
	if not competition.series.has(target_rules.series_id):
		var registered = CampaignCompetition.register_series(competition, target_rules)
		if not registered.ok: return _reject(registered.error, checkpoint)
		competition = registered.competition
	elif competition.series[target_rules.series_id].digest != target_rules.digest:
		return _reject("Target series identity already uses different frozen rules.", checkpoint)
	var created = CampaignCompetition.create_season(competition, next_definition)
	if not created.ok: return _reject(created.error, checkpoint)
	competition = created.competition
	var next_id: String = next_definition.season_id
	var changed = CampaignCompetition.transition_season(competition, next_id, "entries_open")
	if not changed.ok: return _reject(changed.error, checkpoint)
	competition = changed.competition
	var entries = source.entries.values()
	entries.sort_custom(func(a, b): return a.entrant_id < b.entrant_id)
	for prior in entries:
		if prior.status != "accepted": continue
		var submitted = CampaignCompetition.submit_entry(competition, next_id, {
			"entrant_id": prior.entrant_id, "team_id": prior.team_id,
			"person_ids": prior.person_ids, "car_ids": prior.car_ids})
		if not submitted.ok: return _reject(submitted.error, checkpoint)
		competition = submitted.competition
		var accepted = CampaignCompetition.decide_entry(competition, next_id, prior.entrant_id, true)
		if not accepted.ok: return _reject(accepted.error, checkpoint)
		competition = accepted.competition
	for target in ["preseason", "active"]:
		changed = CampaignCompetition.transition_season(competition, next_id, target)
		if not changed.ok: return _reject(changed.error, checkpoint)
		competition = changed.competition
	var economy = restored.economy
	if prize_minor > 0:
		var prize_id = "seasonprize." + source_season_id
		var added = CampaignEconomy.add_commitment(economy, {"id": prize_id,
			"account_id": restored.state.organization_id, "source_id": source_season_id,
			"due_slot": restored.state.clock.elapsed_slots, "amount_minor": prize_minor,
			"category": "prize"}, restored.state.clock.elapsed_slots)
		if not added.ok: return _reject(added.error, checkpoint)
		var settled = CampaignEconomy.settle_due(added.economy, restored.state.clock.elapsed_slots)
		if not settled.ok: return _reject(settled.error, checkpoint)
		economy = settled.economy
	var planning = CampaignSeasonPlanning.record_transition(restored.management.season_planning, {
		"id": "transition." + source_season_id, "source_season_id": source_season_id,
		"next_season_id": next_id, "target_series_id": target_rules.series_id,
		"decision": decision, "rules_digest": target_rules.digest}, restored.state.clock.elapsed_slots)
	if not planning.ok: return _reject(planning.error, checkpoint)
	return _publish_planning(restored, planning, economy, competition, checkpoint)

static func _restore(checkpoint: Dictionary) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok: return _reject(restored.error, checkpoint)
	if not restored.active_manifest.is_empty():
		return _reject("Season planning is frozen while a weekend is active.", checkpoint)
	return restored

static func _publish_planning(restored: Dictionary, changed: Dictionary,
		economy: Dictionary, competition: Dictionary, original: Dictionary) -> Dictionary:
	if not changed.ok: return _reject(changed.error, original, changed.get("status", "rejected"))
	var management = CampaignManagement.with_season_planning(restored.management, changed.season_planning)
	if management.is_empty(): return _reject("Season planning could not update management authority.", original)
	var candidate = CampaignCheckpoint.build(restored.state, restored.settlements,
		restored.active_manifest, competition, economy, restored.inventory,
		restored.personnel, restored.operations, restored.engineering, management)
	if candidate.is_empty(): return _reject("Season planning could not form one valid campaign checkpoint.", original)
	return {"ok": true, "status": changed.status, "error": "", "checkpoint": candidate}

static func _reject(message: String, checkpoint: Dictionary, status: String = "rejected") -> Dictionary:
	return {"ok": false, "status": status, "error": message, "checkpoint": checkpoint.duplicate(true)}
