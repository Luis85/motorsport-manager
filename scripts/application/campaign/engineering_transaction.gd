class_name CampaignEngineeringTransaction
extends RefCounted
## Atomic project/design/part write boundary. Planning freezes during active weekends.


static func create_project(checkpoint: Dictionary, input: Dictionary) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok:
		return restored
	var changed = CampaignEngineering.create_project(
		restored.engineering, input, restored.state.clock.elapsed_slots
	)
	return _publish_changed(restored, changed, restored.economy, checkpoint)


static func bind_stage(
	checkpoint: Dictionary, project_id: String, work_order_id: String
) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok:
		return restored
	var slot = restored.state.clock.elapsed_slots
	var error = CampaignEngineeringOperations.work_order_available(
		restored.engineering, restored.operations, project_id, work_order_id, slot
	)
	if not error.is_empty():
		return _reject(error, checkpoint)
	var changed = CampaignEngineering.bind_stage(
		restored.engineering, project_id, work_order_id, restored.operations, slot
	)
	if not changed.ok:
		return _reject(changed.error, checkpoint, changed.status)
	var economy = restored.economy
	if not changed.commitment_input.is_empty():
		var input: Dictionary = changed.commitment_input.duplicate(true)
		input["account_id"] = restored.state.organization_id
		var committed = CampaignEconomy.add_commitment(economy, input, slot)
		if not committed.ok:
			return _reject(committed.error, checkpoint)
		economy = committed.economy
	return _publish(restored, changed.engineering, economy, changed.status, checkpoint)


static func complete_stage(checkpoint: Dictionary, project_id: String) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok:
		return restored
	var changed = CampaignEngineering.complete_stage(
		restored.engineering, project_id, restored.operations, restored.state.clock.elapsed_slots
	)
	return _publish_changed(restored, changed, restored.economy, checkpoint)


static func _restore(checkpoint: Dictionary) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return _reject(restored.error, checkpoint)
	if not restored.active_manifest.is_empty():
		return _reject(
			"Engineering planning is frozen while a campaign weekend is active.", checkpoint
		)
	return restored


static func _publish_changed(
	restored: Dictionary, changed: Dictionary, economy: Dictionary, original: Dictionary
) -> Dictionary:
	if not changed.ok:
		return _reject(changed.error, original, changed.get("status", "rejected"))
	return _publish(restored, changed.engineering, economy, changed.status, original)


static func _publish(
	restored: Dictionary,
	engineering: Dictionary,
	economy: Dictionary,
	status: String,
	original: Dictionary
) -> Dictionary:
	var candidate = CampaignCheckpoint.build(
		restored.state,
		restored.settlements,
		restored.active_manifest,
		restored.competition,
		economy,
		restored.inventory,
		restored.personnel,
		restored.operations,
		engineering,
		restored.management
	)
	if candidate.is_empty():
		return _reject("Engineering change could not form one valid campaign checkpoint.", original)
	return {"ok": true, "status": status, "error": "", "checkpoint": candidate}


static func _reject(
	message: String, checkpoint: Dictionary, status: String = "rejected"
) -> Dictionary:
	return {
		"ok": false, "status": status, "error": message, "checkpoint": checkpoint.duplicate(true)
	}
