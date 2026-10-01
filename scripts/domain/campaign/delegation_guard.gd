class_name CampaignDelegationGuard
extends RefCounted
## Authorization is explicit and detached. A rejected delegated action mutates nothing.

const OWNER_ROLES = ["operations_lead", "commercial_lead", "technical_lead"]

static func finance_commitment(checkpoint: Dictionary, mandate_id: String,
		input: Dictionary) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok: return _reject(restored.error)
	var delegation: Dictionary = restored.management.delegation
	var error = CampaignDelegation.validate(delegation)
	if not error.is_empty(): return _reject(error)
	if not delegation.mandates.has(mandate_id):
		return _reject("Delegated action references an unknown mandate.")
	var mandate: Dictionary = delegation.mandates[mandate_id]
	var slot = restored.state.clock.elapsed_slots
	if mandate.status != "active" or slot > int(mandate.expiry_slot):
		return _reject("Mandate is revoked or expired.")
	if mandate.scope != "finance":
		return _reject("Mandate does not own financial commitments.")
	if not _owner_available(restored.personnel, mandate.owner_person_id, slot):
		return _reject("Mandate owner is not currently assigned to a qualified leadership role.")
	if input.get("account_id") != restored.state.organization_id 			or input.get("category") not in mandate.allowed_categories:
		return _reject("Delegated commitment is outside the mandate account or categories.")
	if input.get("source_id") in mandate.protected_ids:
		return _reject("Delegated commitment would change a protected resource.")
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
	var preview = CampaignFinanceQuery.commitment_preview(
		checkpoint, input, int(input.get("due_slot", slot)))
	if not preview.ok: return _reject(preview.error)
	if int(preview.forecast.scenarios.committed.minimum_cash_minor) < int(mandate.minimum_cash_minor):
		return _reject("Delegated payment would breach the mandate minimum-liquidity reserve.")
	return {"ok": true, "error": "", "mandate": mandate.duplicate(true),
		"preview": preview, "review_due": slot >= int(mandate.review_slot)}

static func _owner_available(personnel: Dictionary, person_id: String, slot: int) -> bool:
	if not personnel.people.has(person_id): return false
	for assignment in personnel.assignments.values():
		if assignment.person_id == person_id and assignment.role_id in OWNER_ROLES 				and int(assignment.start_slot) <= slot and slot < int(assignment.end_slot):
			var contract: Dictionary = personnel.contracts[assignment.contract_id]
			if CampaignEmploymentContract.status_at(contract, slot) not in ["unknown", "terminated", "expired"]:
				return true
	return false

static func _reject(message: String) -> Dictionary:
	return {"ok": false, "error": message}
