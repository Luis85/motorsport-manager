class_name CampaignCommercialTransaction
extends RefCounted
## Atomic sponsor boundary: contractual money and people obligations are published together.

static func sign_agreement(checkpoint: Dictionary, input: Dictionary) -> Dictionary:
	var restored = _restore(checkpoint, true)
	if not restored.ok: return restored
	var signed = CampaignCommercial.sign(restored.management.commercial, input, restored.state.clock.elapsed_slots)
	if not signed.ok: return _reject(signed.error, checkpoint, signed.status)
	var economy = restored.economy.duplicate(true)
	for commitment in CampaignCommercial.guaranteed_commitments(signed.agreement):
		var added = CampaignEconomy.add_commitment(economy, commitment, restored.state.clock.elapsed_slots)
		if not added.ok: return _reject(added.error, checkpoint)
		economy = added.economy
	var personnel = restored.personnel.duplicate(true)
	for appearance in signed.agreement.appearances:
		if not personnel.assignments.has(appearance.assignment_id):
			return _reject("Sponsor appearance references an unknown role assignment.", checkpoint)
		var assignment: Dictionary = personnel.assignments[appearance.assignment_id]
		if assignment.person_id != appearance.person_id:
			return _reject("Sponsor appearance person differs from its role assignment.", checkpoint)
		var reserved = CampaignPersonnel.reserve_availability(personnel, {
			"id": appearance.id, "person_id": appearance.person_id,
			"assignment_id": appearance.assignment_id, "start_slot": appearance.start_slot,
			"end_slot": appearance.end_slot, "kind": "commercial",
			"location_id": signed.agreement.id}, restored.state.clock.elapsed_slots)
		if not reserved.ok: return _reject(reserved.error, checkpoint)
		personnel = reserved.personnel
	var management = CampaignManagement.with_commercial(restored.management, signed.commercial)
	if management.is_empty(): return _reject("Sponsor agreement could not update management authority.", checkpoint)
	return _publish(restored, management, personnel, economy, "signed", checkpoint)

static func claim_event_bonus(checkpoint: Dictionary, agreement_id: String, event_id: String) -> Dictionary:
	var restored = _restore(checkpoint, false)
	if not restored.ok: return restored
	var claimed = CampaignCommercial.claim_event_bonus(restored.management.commercial,
		agreement_id, event_id, restored.competition, restored.state.clock.elapsed_slots)
	if not claimed.ok: return _reject(claimed.error, checkpoint, claimed.status)
	var added = CampaignEconomy.add_commitment(restored.economy,
		claimed.commitment_input, restored.state.clock.elapsed_slots)
	if not added.ok: return _reject(added.error, checkpoint)
	var settled = CampaignEconomy.settle_due(added.economy, restored.state.clock.elapsed_slots)
	if not settled.ok: return _reject(settled.error, checkpoint)
	var management = CampaignManagement.with_commercial(restored.management, claimed.commercial)
	if management.is_empty(): return _reject("Sponsor bonus could not update management authority.", checkpoint)
	return _publish(restored, management, restored.personnel, settled.economy, "bonus_settled", checkpoint)

static func _restore(checkpoint: Dictionary, planning: bool) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok: return _reject(restored.error, checkpoint)
	if planning and not restored.active_manifest.is_empty():
		return _reject("Commercial planning is frozen while a campaign weekend is active.", checkpoint)
	return restored

static func _publish(restored: Dictionary, management: Dictionary, personnel: Dictionary,
		economy: Dictionary, status: String, original: Dictionary) -> Dictionary:
	var candidate = CampaignCheckpoint.build(restored.state, restored.settlements,
		restored.active_manifest, restored.competition, economy, restored.inventory,
		personnel, restored.operations, restored.engineering, management)
	if candidate.is_empty(): return _reject("Commercial change could not form one valid campaign checkpoint.", original)
	return {"ok": true, "status": status, "error": "", "checkpoint": candidate}

static func _reject(message: String, checkpoint: Dictionary, status: String = "rejected") -> Dictionary:
	return {"ok": false, "status": status, "error": message, "checkpoint": checkpoint.duplicate(true)}
