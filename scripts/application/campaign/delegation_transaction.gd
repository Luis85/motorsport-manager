class_name CampaignDelegationTransaction
extends RefCounted
## Mandate administration. It changes authority, not founder energy or campaign time.

static func create_mandate(checkpoint: Dictionary, input: Dictionary) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok: return restored
	if not restored.personnel.people.has(input.get("owner_person_id")):
		return _reject("Mandate owner is not part of the organization.", checkpoint)
	var changed = CampaignDelegation.create(
		restored.management.delegation, input, restored.state.clock.elapsed_slots)
	if not changed.ok: return _reject(changed.error, checkpoint)
	var management = CampaignManagement.with_delegation(restored.management, changed.delegation)
	if management.is_empty(): return _reject("Mandate could not update management authority.", checkpoint)
	return _publish(restored, management, restored.economy, "created", checkpoint)

static func revoke_mandate(checkpoint: Dictionary, mandate_id: String) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok: return restored
	var changed = CampaignDelegation.revoke(restored.management.delegation,
		mandate_id, restored.state.clock.elapsed_slots)
	if not changed.ok: return _reject(changed.error, checkpoint)
	var management = CampaignManagement.with_delegation(restored.management, changed.delegation)
	if management.is_empty(): return _reject("Mandate revocation could not update management authority.", checkpoint)
	return _publish(restored, management, restored.economy, "revoked", checkpoint)

static func _restore(checkpoint: Dictionary) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok: return _reject(restored.error, checkpoint)
	if not restored.active_manifest.is_empty():
		return _reject("Mandate administration is frozen while a campaign weekend is active.", checkpoint)
	return restored

static func _publish(restored: Dictionary, management: Dictionary,
		economy: Dictionary, status: String, original: Dictionary) -> Dictionary:
	var candidate = CampaignCheckpoint.build(restored.state, restored.settlements,
		restored.active_manifest, restored.competition, economy, restored.inventory,
		restored.personnel, restored.operations, restored.engineering, management)
	if candidate.is_empty(): return _reject("Delegation change could not form one valid campaign checkpoint.", original)
	return {"ok": true, "status": status, "error": "", "checkpoint": candidate}

static func _reject(message: String, checkpoint: Dictionary) -> Dictionary:
	return {"ok": false, "status": "rejected", "error": message, "checkpoint": checkpoint.duplicate(true)}
