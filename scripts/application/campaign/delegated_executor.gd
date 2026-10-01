class_name CampaignDelegatedExecutor
extends RefCounted
## First bounded autonomous action seam. It uses the normal economy authority and
## records the mandate/evidence that permitted the decision.

static func add_commitment(checkpoint: Dictionary, mandate_id: String,
		input: Dictionary, reason: String) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok: return _reject(restored.error, checkpoint)
	if not restored.active_manifest.is_empty():
		return _reject("New delegated campaign commitments are frozen during an active weekend.", checkpoint)
	var allowed = CampaignDelegationGuard.finance_commitment(checkpoint, mandate_id, input)
	if not allowed.ok: return _reject(allowed.error, checkpoint, "escalated")
	var added = CampaignEconomy.add_commitment(
		restored.economy, input, restored.state.clock.elapsed_slots)
	if not added.ok: return _reject(added.error, checkpoint)
	var commitment: Dictionary = added.economy.commitments[input.id]
	var decision_id = "mandatedecision." + RaceStateValue.fingerprint(
		[mandate_id, input.id, restored.state.clock.elapsed_slots]).substr(0, 24)
	var recorded = CampaignDelegation.record_decision(restored.management.delegation, {
		"id": decision_id, "mandate_id": mandate_id, "action": "add_commitment",
		"subject_id": input.id, "slot": restored.state.clock.elapsed_slots,
		"amount_minor": int(input.amount_minor), "reason": reason,
		"source_digest": commitment.terms_digest})
	if not recorded.ok: return _reject(recorded.error, checkpoint)
	var management = CampaignManagement.with_delegation(restored.management, recorded.delegation)
	if management.is_empty(): return _reject("Delegated decision could not update management authority.", checkpoint)
	var candidate = CampaignCheckpoint.build(restored.state, restored.settlements,
		restored.active_manifest, restored.competition, added.economy, restored.inventory,
		restored.personnel, restored.operations, restored.engineering, management)
	if candidate.is_empty(): return _reject("Delegated action could not form one valid campaign checkpoint.", checkpoint)
	return {"ok": true, "status": "executed", "error": "", "checkpoint": candidate,
		"decision": recorded.decision, "review_due": allowed.review_due}

static func _reject(message: String, checkpoint: Dictionary, status: String = "rejected") -> Dictionary:
	return {"ok": false, "status": status, "error": message, "checkpoint": checkpoint.duplicate(true)}
