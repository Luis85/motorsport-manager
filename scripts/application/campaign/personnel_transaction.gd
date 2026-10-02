class_name CampaignPersonnelTransaction
extends RefCounted
## Atomic write boundary for people, employment, responsibilities and availability.
## New planning is frozen while a race weekend is active.

static func register_person(checkpoint: Dictionary, input: Dictionary) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok:
		return restored
	var changed = CampaignPersonnel.register_person(
		restored.personnel, input, restored.state.clock.elapsed_slots)
	return _publish_changed(restored, changed, restored.economy, checkpoint)

static func sign_contract(checkpoint: Dictionary, input: Dictionary) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok:
		return restored
	var slot = restored.state.clock.elapsed_slots
	var changed = CampaignPersonnel.sign_contract(restored.personnel, input, slot)
	if not changed.ok:
		return _reject(changed.error, checkpoint, changed.status)
	var economy = _add_payroll(restored.economy, changed.payroll_inputs, slot)
	if not economy.ok:
		return _reject(economy.error, checkpoint)
	return _publish(restored, changed.personnel, economy.economy, changed.status, checkpoint)

static func assign_role(checkpoint: Dictionary, input: Dictionary) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok:
		return restored
	var changed = CampaignPersonnel.assign_role(
		restored.personnel, input, restored.state.clock.elapsed_slots)
	return _publish_changed(restored, changed, restored.economy, checkpoint)

static func reserve_availability(checkpoint: Dictionary, input: Dictionary) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok:
		return restored
	var changed = CampaignPersonnel.reserve_availability(
		restored.personnel, input, restored.state.clock.elapsed_slots)
	return _publish_changed(restored, changed, restored.economy, checkpoint)

static func cancel_reservation(checkpoint: Dictionary, reservation_id: String) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok:
		return restored
	var changed = CampaignPersonnel.cancel_reservation(
		restored.personnel, reservation_id, restored.state.clock.elapsed_slots)
	return _publish_changed(restored, changed, restored.economy, checkpoint)

static func terminate_contract(checkpoint: Dictionary,
		contract_id: String, reason: String) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok:
		return restored
	var slot = restored.state.clock.elapsed_slots
	var due = CampaignEconomy.settle_due(restored.economy, slot)
	if not due.ok:
		return _reject(due.error, checkpoint)
	var changed = CampaignPersonnel.terminate_contract(
		restored.personnel, contract_id, slot, reason)
	if not changed.ok:
		return _reject(changed.error, checkpoint, changed.status)
	var economy = _cancel_commitments(due.economy, changed.cancel_commitment_ids, slot)
	if not economy.ok:
		return _reject(economy.error, checkpoint)
	var result = _publish(restored, changed.personnel, economy.economy, changed.status, checkpoint)
	if result.ok:
		result["settled_count"] = due.get("settled_count", 0)
		result["cancelled_payroll_count"] = economy.cancelled_count
	return result

static func renew_contract(checkpoint: Dictionary,
		contract_id: String, input: Dictionary) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok:
		return restored
	var slot = restored.state.clock.elapsed_slots
	var changed = CampaignPersonnel.renew_contract(
		restored.personnel, contract_id, input, slot)
	if not changed.ok:
		return _reject(changed.error, checkpoint, changed.status)
	var economy = _add_payroll(restored.economy, changed.payroll_inputs, slot)
	if not economy.ok:
		return _reject(economy.error, checkpoint)
	return _publish(restored, changed.personnel, economy.economy, changed.status, checkpoint)

static func replace_contract(checkpoint: Dictionary, outgoing_contract_id: String,
		incoming_terms: Dictionary, reason: String) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok:
		return restored
	var slot = restored.state.clock.elapsed_slots
	if incoming_terms.get("start_slot") != slot:
		return _reject("Replacement employment must begin at authoritative campaign time.", checkpoint)
	if not restored.personnel.contracts.has(outgoing_contract_id):
		return _reject("Outgoing campaign employment contract is unknown.", checkpoint)
	if incoming_terms.get("person_id") == restored.personnel.contracts[outgoing_contract_id].person_id:
		return _reject("Replacement employment requires a different registered person.", checkpoint)
	var due = CampaignEconomy.settle_due(restored.economy, slot)
	if not due.ok:
		return _reject(due.error, checkpoint)
	var ended = CampaignPersonnel.terminate_contract(
		restored.personnel, outgoing_contract_id, slot, reason)
	if not ended.ok:
		return _reject(ended.error, checkpoint, ended.status)
	var economy = _cancel_commitments(due.economy, ended.cancel_commitment_ids, slot)
	if not economy.ok:
		return _reject(economy.error, checkpoint)
	var signed = CampaignPersonnel.sign_contract(ended.personnel, incoming_terms, slot)
	if not signed.ok:
		return _reject(signed.error, checkpoint, signed.status)
	economy = _add_payroll(economy.economy, signed.payroll_inputs, slot)
	if not economy.ok:
		return _reject(economy.error, checkpoint)
	var result = _publish(restored, signed.personnel, economy.economy, "replaced", checkpoint)
	if result.ok:
		result["settled_count"] = due.get("settled_count", 0)
		result["cancelled_payroll_count"] = ended.cancel_commitment_ids.size()
	return result

static func _restore(checkpoint: Dictionary) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return _reject(restored.error, checkpoint)
	if not restored.active_manifest.is_empty():
		return _reject("Personnel planning is frozen while a campaign weekend is active.", checkpoint)
	return restored

static func _publish_changed(restored: Dictionary, changed: Dictionary,
		economy: Dictionary, original: Dictionary) -> Dictionary:
	if not changed.ok:
		return _reject(changed.error, original, changed.get("status", "rejected"))
	return _publish(restored, changed.personnel, economy, changed.status, original)

static func _publish(restored: Dictionary, personnel: Dictionary, economy: Dictionary,
		status: String, original: Dictionary) -> Dictionary:
	var candidate = CampaignCheckpoint.build(
		restored.state,
		restored.settlements,
		restored.active_manifest,
		restored.competition,
		economy,
		restored.inventory,
		personnel,
		restored.operations,
		restored.engineering,
		restored.management
	)
	if candidate.is_empty():
		return _reject("Personnel change could not form one valid campaign checkpoint.", original)
	return {"ok": true, "status": status, "error": "", "checkpoint": candidate}

static func _add_payroll(current: Dictionary, inputs: Array, created_slot: int) -> Dictionary:
	var economy = current.duplicate(true)
	for input in inputs:
		var changed = CampaignEconomy.add_commitment(economy, input, created_slot)
		if not changed.ok:
			return {"ok": false, "error": changed.error, "economy": current.duplicate(true)}
		economy = changed.economy
	return {"ok": true, "error": "", "economy": economy}

static func _cancel_commitments(current: Dictionary, ids: Array, slot: int) -> Dictionary:
	var economy = current.duplicate(true)
	var cancelled_count = 0
	for commitment_id in ids:
		if not economy.commitments.has(commitment_id):
			return {"ok": false, "error": "Employment payroll commitment is missing.",
				"economy": current.duplicate(true)}
		if economy.commitments[commitment_id].status == "cancelled":
			continue
		if economy.commitments[commitment_id].status != "open":
			return {"ok": false, "error": "Future employment payroll is already settled.",
				"economy": current.duplicate(true)}
		var changed = CampaignEconomy.cancel_commitment(economy, commitment_id, slot)
		if not changed.ok:
			return {"ok": false, "error": changed.error, "economy": current.duplicate(true)}
		economy = changed.economy
		cancelled_count += 1
	return {"ok": true, "error": "", "economy": economy,
		"cancelled_count": cancelled_count}

static func _reject(message: String, checkpoint: Dictionary,
		status: String = "rejected") -> Dictionary:
	return {"ok": false, "status": status, "error": message,
		"checkpoint": checkpoint.duplicate(true)}
