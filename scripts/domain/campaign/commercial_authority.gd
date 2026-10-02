class_name CampaignCommercialAuthority
extends RefCounted
## Cross-authority sponsor invariants: promised money lives in Economy and promised
## appearances live in Personnel.

static func validate(commercial: Dictionary, personnel: Dictionary,
		economy: Dictionary, current_slot: int) -> String:
	var error = CampaignCommercial.validate(commercial)
	if not error.is_empty(): return error
	for agreement in commercial.agreements.values():
		if agreement.account_id != personnel.organization_id or not economy.accounts.has(agreement.account_id):
			return "Sponsor agreement belongs to another organization."
		if int(agreement.signed_slot) > current_slot:
			return "Sponsor agreement was signed after authoritative campaign time."
		for input in CampaignCommercial.guaranteed_commitments(agreement):
			if not economy.commitments.has(input.id):
				return "Sponsor guaranteed payment is missing from campaign commitments."
			var commitment: Dictionary = economy.commitments[input.id]
			if commitment.account_id != input.account_id or commitment.source_id != input.source_id 					or int(commitment.due_slot) != int(input.due_slot) 					or int(commitment.amount_minor) != int(input.amount_minor) 					or commitment.category != "sponsor":
				return "Sponsor guaranteed payment disagrees with its agreement."
		for appearance in agreement.appearances:
			if not personnel.reservations.has(appearance.id):
				return "Sponsor appearance is missing its personnel reservation."
			var reservation: Dictionary = personnel.reservations[appearance.id]
			if reservation.person_id != appearance.person_id or reservation.assignment_id != appearance.assignment_id 					or reservation.kind != "commercial" or int(reservation.start_slot) != int(appearance.start_slot) 					or int(reservation.end_slot) != int(appearance.end_slot):
				return "Sponsor appearance reservation disagrees with its agreement."
	for claim in commercial.bonus_claims.values():
		if int(claim.claim_slot) > current_slot or not economy.commitments.has(claim.commitment_id):
			return "Sponsor bonus claim lacks dated financial evidence."
		var commitment: Dictionary = economy.commitments[claim.commitment_id]
		if commitment.source_id != claim.agreement_id or commitment.category != "sponsor" 				or int(commitment.amount_minor) != int(claim.amount_minor):
			return "Sponsor bonus cash commitment disagrees with the proven claim."
	return ""
