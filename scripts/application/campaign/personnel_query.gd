class_name CampaignPersonnelQuery
extends RefCounted
## Detached roster and employment previews. Queries issue no commands or writes.


static func roster(checkpoint: Dictionary) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return {"ok": false, "error": restored.error}
	var slot = restored.state.clock.elapsed_slots
	var rows: Array = []
	var person_ids = restored.personnel.people.keys()
	person_ids.sort()
	for person_id in person_ids:
		var person: Dictionary = restored.personnel.people[person_id]
		var contracts: Array = []
		for contract in restored.personnel.contracts.values():
			if contract.person_id == person_id:
				contracts.append(
					{
						"id": contract.id,
						"status": CampaignEmploymentContract.status_at(contract, slot),
						"start_slot": contract.start_slot,
						"end_slot": contract.end_slot,
						"pay_minor": contract.pay_minor
					}
				)
		contracts.sort_custom(
			func(left, right):
				return (
					int(left.start_slot) < int(right.start_slot)
					or (int(left.start_slot) == int(right.start_slot) and left.id < right.id)
				)
		)
		var assignments: Array = []
		for assignment in restored.personnel.assignments.values():
			if assignment.person_id != person_id:
				continue
			var contract: Dictionary = restored.personnel.contracts[assignment.contract_id]
			var contract_status = CampaignEmploymentContract.status_at(contract, slot)
			assignments.append(
				{
					"id": assignment.id,
					"role_id": assignment.role_id,
					"start_slot": assignment.start_slot,
					"end_slot": assignment.end_slot,
					"allocation_bps": assignment.allocation_bps,
					"active_now":
					(
						int(assignment.start_slot) <= slot
						and slot < int(assignment.end_slot)
						and contract_status in ["active", "renewal_window"]
					)
				}
			)
		assignments.sort_custom(
			func(left, right):
				return (
					int(left.start_slot) < int(right.start_slot)
					or (int(left.start_slot) == int(right.start_slot) and left.id < right.id)
				)
		)
		var available_now = false
		if slot < CampaignClock.MAX_ELAPSED_SLOTS:
			available_now = (
				CampaignPersonnel
				. availability_error(restored.personnel, person_id, slot, slot + 1)
				. is_empty()
			)
		rows.append(
			{
				"id": person_id,
				"display_name": person.display_name,
				"eligible_roles": person.eligible_roles.duplicate(true),
				"contracts": contracts,
				"assignments": assignments,
				"available_now": available_now
			}
		)
	return {"ok": true, "error": "", "slot": slot, "people": rows}


static func contract_preview(
	checkpoint: Dictionary, input: Dictionary, through_slot: int
) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return {"ok": false, "error": restored.error}
	var slot = restored.state.clock.elapsed_slots
	var changed = CampaignPersonnel.sign_contract(restored.personnel, input, slot)
	if not changed.ok:
		return {"ok": false, "error": changed.error}
	var economy = restored.economy.duplicate(true)
	for payroll_input in changed.payroll_inputs:
		var finance = CampaignEconomy.add_commitment(economy, payroll_input, slot)
		if not finance.ok:
			return {"ok": false, "error": finance.error}
		economy = finance.economy
	var forecast = CampaignCashForecast.build(economy, input.get("account_id"), slot, through_slot)
	if not forecast.ok:
		return forecast
	return {
		"ok": true,
		"error": "",
		"contract": changed.contract.duplicate(true),
		"payroll_commitment_count": changed.payroll_inputs.size(),
		"total_committed_pay_minor":
		int(changed.contract.pay_minor) * changed.payroll_inputs.size(),
		"forecast": forecast.forecast.duplicate(true),
		"source_checkpoint_digest": checkpoint.get("digest", "")
	}
