class_name CampaignDelegationGuard
extends RefCounted
## Pure domain authorization for bounded delegated finance. Application code supplies
## detached forecast evidence; this layer never restores checkpoints or calls queries.

const OWNER_ROLES = ["operations_lead", "commercial_lead", "technical_lead"]


static func finance_commitment(
	delegation: Dictionary,
	personnel: Dictionary,
	organization_id: String,
	current_slot: int,
	mandate_id: String,
	input: Dictionary,
	committed_minimum_cash_minor: int
) -> Dictionary:
	var error = CampaignDelegation.validate(delegation)
	if not error.is_empty():
		return _reject(error)
	if not CampaignPersonnel.validate(personnel).is_empty():
		return _reject("Delegated action has invalid personnel authority.")
	if (
		not CampaignIdentity.valid(organization_id)
		or not RaceCheckpoint.integral(current_slot, 0, CampaignClock.MAX_ELAPSED_SLOTS)
	):
		return _reject("Delegated action has invalid organization or time authority.")
	if not delegation.mandates.has(mandate_id):
		return _reject("Delegated action references an unknown mandate.")
	var mandate: Dictionary = delegation.mandates[mandate_id]
	var mandate_error = _mandate_error(mandate, personnel, organization_id, current_slot, input)
	if not mandate_error.is_empty():
		return _reject(mandate_error)
	var amount = input.get("amount_minor")
	if not RaceCheckpoint.integral(amount, -CampaignEconomy.MAX_MINOR, -1):
		return _reject("Delegated finance mandate may create bounded payments only.")
	var spend = -int(amount)
	if spend > int(mandate.spending_ceiling_minor):
		return _reject("Delegated payment exceeds the per-decision spending ceiling.")
	var committed = 0
	for decision in delegation.decisions:
		if decision.mandate_id == mandate_id:
			committed += -int(decision.amount_minor)
	if committed + spend > int(mandate.future_obligation_ceiling_minor):
		return _reject("Delegated payment exceeds the mandate future-obligation ceiling.")
	if committed_minimum_cash_minor < int(mandate.minimum_cash_minor):
		return _reject("Delegated payment would breach the mandate minimum-liquidity reserve.")
	return {
		"ok": true,
		"error": "",
		"mandate": mandate.duplicate(true),
		"review_due": current_slot >= int(mandate.review_slot)
	}


static func _owner_available(personnel: Dictionary, person_id: String, slot: int) -> bool:
	if not personnel.people.has(person_id):
		return false
	for assignment in personnel.assignments.values():
		if (
			assignment.person_id == person_id
			and assignment.role_id in OWNER_ROLES
			and int(assignment.start_slot) <= slot
			and slot < int(assignment.end_slot)
		):
			var contract: Dictionary = personnel.contracts[assignment.contract_id]
			if (
				CampaignEmploymentContract.status_at(contract, slot)
				not in ["unknown", "terminated", "expired"]
			):
				return true
	return false


static func _reject(message: String) -> Dictionary:
	return {"ok": false, "error": message}


static func _mandate_error(
	mandate: Dictionary,
	personnel: Dictionary,
	organization_id: String,
	current_slot: int,
	input: Dictionary
) -> String:
	if mandate.status != "active" or current_slot > int(mandate.expiry_slot):
		return "Mandate is revoked or expired."
	if mandate.scope != "finance":
		return "Mandate does not own financial commitments."
	if not _owner_available(personnel, mandate.owner_person_id, current_slot):
		return "Mandate owner is not currently assigned to a qualified leadership role."
	if (
		input.get("account_id") != organization_id
		or input.get("category") not in mandate.allowed_categories
	):
		return "Delegated commitment is outside the mandate account or categories."
	if input.get("source_id") in mandate.protected_ids:
		return "Delegated commitment would change a protected resource."
	return ""
