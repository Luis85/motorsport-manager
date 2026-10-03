class_name CampaignDelegationQuery
extends RefCounted
## Read-only ownership/escalation summary for Director Desk and specialist screens.


static func summary(checkpoint: Dictionary) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return {"ok": false, "error": restored.error}
	var slot = restored.state.clock.elapsed_slots
	var rows: Array = []
	for mandate in restored.management.delegation.mandates.values():
		rows.append(
			{
				"id": mandate.id,
				"owner_person_id": mandate.owner_person_id,
				"scope": mandate.scope,
				"status": mandate.status,
				"review_due": mandate.status == "active" and slot >= int(mandate.review_slot),
				"expires_in_slots": maxi(0, int(mandate.expiry_slot) - slot),
				"decision_count":
				_decision_count(restored.management.delegation.decisions, mandate.id)
			}
		)
	rows.sort_custom(func(a, b): return a.scope < b.scope)
	return {"ok": true, "error": "", "mandates": rows, "source_digest": restored.management.digest}


static func _decision_count(decisions: Array, mandate_id: String) -> int:
	var count = 0
	for decision in decisions:
		if decision.mandate_id == mandate_id:
			count += 1
	return count
