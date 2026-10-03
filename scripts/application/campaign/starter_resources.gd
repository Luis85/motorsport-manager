class_name CampaignStarterResources
extends RefCounted
## Initial employment, owned facilities and rival registrations from authored campaign content.
const DAY = CampaignStarter.DAY


static func _add_player_people(
	checkpoint: Dictionary, initial: Dictionary, config: Dictionary
) -> Dictionary:
	var player_ids: Array = []
	for car in initial.cars:
		if car.get("player", false):
			player_ids.append(int(car.id))
	if player_ids.size() != int(config.series.cars_per_entrant):
		return {}
	for race_id in player_ids:
		var car: Dictionary = initial.cars[race_id]
		checkpoint = _employ(
			checkpoint,
			CampaignStarter._person_id(race_id),
			str(car.name),
			config.player.driver_role_id,
			config.player.driver_contract
		)
		if checkpoint.is_empty():
			return {}
	var lead: Dictionary = config.player.operations_lead
	return _employ(checkpoint, lead.person_id, lead.display_name, lead.role_id, lead.contract)


static func _employ(
	checkpoint: Dictionary,
	person_id: String,
	name: String,
	role: String,
	contract_config: Dictionary
) -> Dictionary:
	var person = CampaignPersonnelTransaction.register_person(
		checkpoint, {"id": person_id, "display_name": name, "eligible_roles": [role]}
	)
	if not person.ok:
		return {}
	var contract_id = "contract." + person_id
	var contract = CampaignPersonnelTransaction.sign_contract(
		person.checkpoint,
		{
			"id": contract_id,
			"person_id": person_id,
			"account_id": CampaignCheckpoint.restore(person.checkpoint).state.organization_id,
			"start_slot": 0,
			"end_slot": int(contract_config.duration_days) * DAY,
			"pay_interval_slots": int(contract_config.pay_interval_days) * DAY,
			"pay_minor": contract_config.pay_minor,
			"capacity_bps": contract_config.allocation_bps,
			"renewal_window_slots": int(contract_config.renewal_window_days) * DAY
		}
	)
	if not contract.ok:
		return {}
	var assignment = CampaignPersonnelTransaction.assign_role(
		contract.checkpoint,
		{
			"id": "assignment." + person_id,
			"person_id": person_id,
			"contract_id": contract_id,
			"role_id": role,
			"start_slot": 0,
			"end_slot": int(contract_config.duration_days) * DAY,
			"allocation_bps": contract_config.allocation_bps
		}
	)
	return assignment.checkpoint if assignment.ok else {}


static func _add_facilities(checkpoint: Dictionary, facilities: Array) -> Dictionary:
	for item in facilities:
		var changed = CampaignOperationsTransaction.register_owned(
			checkpoint,
			{
				"id": item.id,
				"display_name": item.display_name,
				"family": item.family,
				"available_from_slot": 0,
				"available_until_slot": int(item.available_days) * DAY,
				"capacity_units": item.capacity_units
			}
		)
		if not changed.ok:
			return {}
		checkpoint = changed.checkpoint
	return checkpoint


static func _add_rivals(checkpoint: Dictionary, configs: Array, policy: Dictionary) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return {}
	var season = CampaignStarter._current_season(restored)
	if season.is_empty():
		return {}
	for config in configs:
		var entry: Dictionary = season.entries.get(config.entrant_id, {})
		if entry.is_empty() or entry.status != "accepted" or entry.team_id != config.team_id:
			return {}
		var changed = CampaignRivalTransaction.register_team(
			checkpoint,
			{
				"team_id": entry.team_id,
				"entrant_id": entry.entrant_id,
				"person_ids": entry.person_ids,
				"car_ids": entry.car_ids,
				"archetype": config.archetype,
				"cash_minor": config.cash_minor,
				"reserve_minor": config.reserve_minor,
				"capability_bps": config.capability_bps,
				"policy": policy,
				"next_review_slot": 0,
				"review_interval_slots": int(config.review_interval_days) * DAY
			}
		)
		if not changed.ok:
			return {}
		checkpoint = changed.checkpoint
	return checkpoint
