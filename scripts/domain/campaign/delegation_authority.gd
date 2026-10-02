class_name CampaignDelegationAuthority
extends RefCounted
## Persistent mandate records must reference known people and auditable finance evidence.

static func validate(delegation: Dictionary, personnel: Dictionary,
		economy: Dictionary, current_slot: int) -> String:
	var error = CampaignDelegation.validate(delegation)
	if not error.is_empty(): return error
	for mandate in delegation.mandates.values():
		if not personnel.people.has(mandate.owner_person_id) or int(mandate.created_slot) > current_slot:
			return "Campaign mandate references an unknown or future owner."
	for decision in delegation.decisions:
		if int(decision.slot) > current_slot or not economy.commitments.has(decision.subject_id):
			return "Delegated decision lacks dated financial evidence."
		var commitment: Dictionary = economy.commitments[decision.subject_id]
		if commitment.terms_digest != decision.source_digest 				or int(commitment.amount_minor) != int(decision.amount_minor):
			return "Delegated decision disagrees with its financial commitment."
	return ""
