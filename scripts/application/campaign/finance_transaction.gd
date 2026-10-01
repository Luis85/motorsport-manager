class_name CampaignFinanceTransaction
extends RefCounted
## Atomic application boundary for binding/cancelling commitments, reserve policy
## and due settlement. Planning changes are frozen during an active weekend.

static func add_commitment(checkpoint: Dictionary, input: Dictionary) -> Dictionary:
	var restored = _restore(checkpoint, true)
	if not restored.ok:
		return restored
	var changed = CampaignEconomy.add_commitment(
		restored.economy, input, restored.state.clock.elapsed_slots)
	return _publish(restored, changed, checkpoint)

static func cancel_commitment(checkpoint: Dictionary, commitment_id: String) -> Dictionary:
	var restored = _restore(checkpoint, true)
	if not restored.ok:
		return restored
	var changed = CampaignEconomy.cancel_commitment(
		restored.economy, commitment_id, restored.state.clock.elapsed_slots)
	return _publish(restored, changed, checkpoint)

static func set_reserve_policy(checkpoint: Dictionary,
		account_id: String, minimum_cash_minor: int) -> Dictionary:
	var restored = _restore(checkpoint, true)
	if not restored.ok:
		return restored
	var changed = CampaignEconomy.set_reserve_policy(
		restored.economy, account_id, minimum_cash_minor,
		restored.state.clock.elapsed_slots)
	return _publish(restored, changed, checkpoint)

static func settle_due(checkpoint: Dictionary, through_slot: int) -> Dictionary:
	var restored = _restore(checkpoint, false)
	if not restored.ok:
		return restored
	if through_slot > restored.state.clock.elapsed_slots:
		return _reject("Cash commitments cannot settle beyond authoritative campaign time.", checkpoint)
	var changed = CampaignEconomy.settle_due(restored.economy, through_slot)
	var result = _publish(restored, changed, checkpoint)
	if result.ok:
		result["settled_count"] = changed.get("settled_count", 0)
	return result

static func _restore(checkpoint: Dictionary, require_planning_access: bool) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return _reject(restored.error, checkpoint)
	if require_planning_access and not restored.active_manifest.is_empty():
		return _reject("Financial planning is frozen while a campaign weekend is active.", checkpoint)
	return restored

static func _publish(restored: Dictionary, changed: Dictionary, original: Dictionary) -> Dictionary:
	if not changed.ok:
		return _reject(changed.error, original, changed.get("status", "rejected"))
	var candidate = CampaignCheckpoint.build(
		restored.state,
		restored.settlements,
		restored.active_manifest,
		restored.competition,
		changed.economy,
		restored.inventory,
		restored.personnel
	)
	if candidate.is_empty():
		return _reject("Financial change could not form one valid campaign checkpoint.", original)
	return {"ok": true, "status": changed.status, "error": "", "checkpoint": candidate}

static func _reject(message: String, checkpoint: Dictionary, status: String = "rejected") -> Dictionary:
	return {"ok": false, "status": status, "error": message,
		"checkpoint": checkpoint.duplicate(true)}
