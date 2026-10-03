class_name CampaignDirectorQuery
extends RefCounted
## Detached Director Desk projection: decisions first, accounting detail second.
## No command, RNG draw, persistence write or campaign mutation occurs here.


static func overview(checkpoint: Dictionary) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return {"ok": false, "error": restored.error}
	var season = _current_season(restored.competition)
	var player_entry = _player_entry(season, restored.personnel)
	var next_event = _next_event(season)
	var through_slot = maxi(
		restored.state.clock.elapsed_slots,
		int(
			next_event.get(
				"return_slot", restored.state.clock.elapsed_slots + 30 * CampaignClock.SLOTS_PER_DAY
			)
		)
	)
	var forecast_result = CampaignFinanceQuery.cash_forecast(
		checkpoint, restored.state.organization_id, through_slot
	)
	var forecast = forecast_result.forecast if forecast_result.ok else {}
	var priorities = _priorities(restored, season, next_event, forecast)
	var work = _work(restored)
	var debrief = _debrief(restored, season, player_entry)
	var onboarding = _onboarding(restored, season)
	var rivals = CampaignRivalQuery.summary(checkpoint)
	return {
		"ok": true,
		"error": "",
		"campaign_id": restored.state.campaign_id,
		"organization_id": restored.state.organization_id,
		"date": _date_label(restored.state.clock),
		"slot": restored.state.clock.elapsed_slots,
		"energy":
		{"available": restored.state.energy_available, "capacity": restored.state.energy_capacity},
		"cash_minor": int(restored.economy.accounts[restored.state.organization_id].cash_minor),
		"forecast": forecast,
		"season": _season_summary(season, player_entry),
		"next_event": next_event,
		"priorities": priorities,
		"work": work,
		"debrief": debrief,
		"onboarding": onboarding,
		"rivals": rivals.get("teams", []),
		"active_weekend": not restored.active_manifest.is_empty(),
		"source_digest": restored.checkpoint.digest
	}


static func _current_season(competition: Dictionary) -> Dictionary:
	var ids = competition.seasons.keys()
	ids.sort()
	var fallback = {}
	for season_id in ids:
		var season: Dictionary = competition.seasons[season_id]
		if season.status != "completed":
			return season
		fallback = season
	return fallback


static func _player_entry(season: Dictionary, personnel: Dictionary) -> Dictionary:
	if season.is_empty():
		return {}
	for entry in season.entries.values():
		if entry.status != "accepted":
			continue
		for person_id in entry.person_ids:
			if personnel.people.has(person_id):
				return entry
	return {}


static func _next_event(season: Dictionary) -> Dictionary:
	if season.is_empty():
		return {}
	var event_id = CampaignSeason.next_scheduled_event_id(season)
	return (
		CampaignSeason.calendar_event(season, event_id).duplicate(true)
		if not event_id.is_empty()
		else {}
	)


static func _priorities(
	restored: Dictionary, season: Dictionary, next_event: Dictionary, forecast: Dictionary
) -> Array:
	var rows: Array = []
	if not restored.active_manifest.is_empty():
		(
			rows
			. append(
				_priority(
					"weekend_active",
					"Weekend in progress",
					"The campaign is frozen at departure while the race weekend owns sporting execution.",
					100
				)
			)
		)
	elif not next_event.is_empty():
		var delta = int(next_event.departure_slot) - restored.state.clock.elapsed_slots
		if delta <= 0:
			rows.append(
				_priority(
					"depart",
					"Next event is ready for departure",
					"Review readiness, then freeze the exact entrant and open the race weekend.",
					95
				)
			)
		else:
			rows.append(
				_priority(
					"advance",
					"Next event in %d campaign slots" % delta,
					"Advance only after reviewing commitments and work due before departure.",
					80
				)
			)
	if not forecast.is_empty() and forecast.scenarios.committed.breaches_reserve:
		rows.append(
			_priority(
				"finance",
				"Committed plan breaches the cash reserve",
				(
					"Minimum projected cash is %d against a reserve of %d."
					% [
						int(forecast.scenarios.committed.minimum_cash_minor),
						int(forecast.reserve_minor)
					]
				),
				90
			)
		)
	for mandate in restored.management.delegation.mandates.values():
		if (
			mandate.status == "active"
			and restored.state.clock.elapsed_slots >= int(mandate.review_slot)
		):
			rows.append(
				_priority(
					"mandate",
					"A delegated mandate is due for review",
					(
						"%s authority remains active until explicitly revised or revoked."
						% mandate.scope.capitalize()
					),
					70
				)
			)
			break
	for project in restored.engineering.projects.values():
		if project.stage != "complete":
			(
				rows
				. append(
					_priority(
						"engineering",
						project.title,
						(
							"Engineering is at %s; the next gate still uses explicit people and facility capacity."
							% str(project.stage).replace("_", " ")
						),
						60
					)
				)
			)
			break
	if next_event.is_empty() and not season.is_empty() and season.status == "active":
		rows.append(
			_priority(
				"season_finish",
				"Sporting calendar complete",
				"Finalize classification and close the season transition.",
				85
			)
		)
	rows.sort_custom(func(a, b): return int(a.rank) > int(b.rank))
	return rows.slice(0, mini(3, rows.size()))


static func _priority(id: String, title: String, detail: String, rank: int) -> Dictionary:
	return {"id": id, "title": title, "detail": detail, "rank": rank}


static func _work(restored: Dictionary) -> Array:
	var rows: Array = []
	for order in restored.operations.work_orders.values():
		var state = CampaignWorkOrder.state_at(order, restored.state.clock.elapsed_slots)
		if state in ["planned", "active"]:
			rows.append(
				{
					"kind": "work",
					"title": order.id,
					"state": state,
					"due_slot": int(order.end_slot),
					"detail": order.family.replace("_", " ")
				}
			)
	for project in restored.engineering.projects.values():
		if project.stage != "complete":
			rows.append(
				{
					"kind": "engineering",
					"title": project.title,
					"state": project.stage,
					"due_slot": -1,
					"detail": project.domain.replace("_", " ")
				}
			)
	rows.sort_custom(func(a, b): return int(a.due_slot) < int(b.due_slot))
	return rows.slice(0, mini(5, rows.size()))


static func _debrief(
	restored: Dictionary, season: Dictionary, player_entry: Dictionary
) -> Dictionary:
	if season.is_empty() or player_entry.is_empty():
		return {}
	var completed: Array = []
	for item in season.calendar:
		if item.status == "completed":
			completed.append(item)
	if completed.is_empty():
		return {}
	var item: Dictionary = completed.back()
	if not restored.competition.events.has(item.campaign_event_id):
		return {}
	var event: Dictionary = restored.competition.events[item.campaign_event_id]
	var facts: Array = []
	var positions: Array = []
	for award in event.awards:
		if award.person_id in player_entry.person_ids:
			positions.append(int(award.position))
	if not positions.is_empty():
		positions.sort()
		var position_text = ""
		for index in range(positions.size()):
			position_text += (" and P" if index > 0 else "") + str(positions[index])
		facts.append({"level": "observed", "text": "Your cars finished P%s." % position_text})
	var delta = 0
	if restored.economy.events.has(item.campaign_event_id):
		var finance = restored.economy.events[item.campaign_event_id]
		for posting_id in finance.posting_ids:
			delta += int(
				restored.economy.accounts[finance.account_id].postings[posting_id].amount_minor
			)
		facts.append(
			{
				"level": "observed",
				"text": "Weekend sporting settlement changed cash by %d credits." % delta
			}
		)
	_add_returned_health(restored, item, player_entry, facts)
	return {
		"event_id": item.campaign_event_id,
		"round": int(item.round),
		"facts": facts.slice(0, mini(3, facts.size())),
		"note": "Observed facts are separated from interpretation; no alternate result is claimed."
	}


static func _onboarding(restored: Dictionary, season: Dictionary) -> Dictionary:
	var first_resolved = restored.settlements.receipts.size() > 0
	var active = not restored.active_manifest.is_empty()
	var first_return = 0
	if not season.is_empty() and not season.calendar.is_empty():
		first_return = int(season.calendar[0].return_slot)
	return {
		"steps":
		[
			{"title": "Read the Director Desk", "done": true},
			{"title": "Launch the first prepared event", "done": active or first_resolved},
			{"title": "Finish and settle the first weekend", "done": first_resolved},
			{
				"title": "Advance toward the next decision",
				"done": first_resolved and restored.state.clock.elapsed_slots > first_return
			}
		]
	}


static func _season_summary(season: Dictionary, player_entry: Dictionary) -> Dictionary:
	if season.is_empty():
		return {}
	var position = 0
	var points = 0
	if not player_entry.is_empty():
		for row in season.rankings.teams:
			if row.identity == player_entry.team_id:
				position = int(row.position)
				points = int(row.points)
				break
	return {
		"season_id": season.season_id,
		"status": season.status,
		"position": position,
		"points": points,
		"completed_events": season.calendar.filter(func(e): return e.status == "completed").size(),
		"total_events": season.calendar.size()
	}


static func _date_label(clock: CampaignClock) -> String:
	var hour = int(clock.slot_of_day * CampaignClock.SLOT_MINUTES / 60)
	var minute = int(clock.slot_of_day * CampaignClock.SLOT_MINUTES) % 60
	return "%04d-%02d-%02d %02d:%02d" % [clock.year, clock.month, clock.day, hour, minute]


static func _add_returned_health(
	restored: Dictionary, item: Dictionary, player_entry: Dictionary, facts: Array
) -> void:
	if restored.inventory.events.has(item.campaign_event_id):
		var health = 0.0
		var count = 0
		for returned in restored.inventory.events[item.campaign_event_id].returns:
			if returned.person_id in player_entry.person_ids:
				health += float(returned.health)
				count += 1
		if count > 0:
			facts.append(
				{
					"level": "observed",
					"text":
					"Returned player cars average %.0f%% aggregate health." % (health / count)
				}
			)
