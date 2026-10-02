class_name CampaignPersonnelEconomy
extends RefCounted
## Cross-envelope payroll authority. Contracts own terms; the economy owns cash.

static func validate(personnel: Dictionary, economy: Dictionary, current_slot: int) -> String:
	var error = CampaignPersonnel.validate(personnel)
	if not error.is_empty():
		return error
	error = CampaignEconomy.validate(economy)
	if not error.is_empty():
		return error
	if not RaceCheckpoint.integral(current_slot, 0, CampaignClock.MAX_ELAPSED_SLOTS):
		return "Campaign payroll validation has no valid authoritative time boundary."
	if personnel.campaign_id != economy.campaign_id:
		return "Campaign personnel and economy belong to different campaigns."
	if not economy.accounts.has(personnel.organization_id):
		return "Campaign payroll account is absent from the economy."
	var indexed = {}
	error = _contract_payroll_error(personnel, economy, current_slot, indexed)
	if not error.is_empty():
		return error
	return _unowned_payroll_error(personnel, economy, indexed)

static func _contract_payroll_error(personnel: Dictionary, economy: Dictionary,
		current_slot: int, indexed: Dictionary) -> String:
	for contract_id in personnel.contracts:
		var contract: Dictionary = personnel.contracts[contract_id]
		if not economy.accounts.has(contract.account_id):
			return "Campaign employment contract references an unknown payroll account."
		for input in CampaignEmploymentContract.payroll_inputs(contract):
			var commitment_id: String = input.id
			if indexed.has(commitment_id) or not economy.commitments.has(commitment_id):
				return "Campaign employment payroll commitment is missing or duplicated."
			var error = _commitment_error(
				contract_id, contract, input, economy.commitments[commitment_id], current_slot)
			if not error.is_empty():
				return error
			indexed[commitment_id] = true
	return ""

static func _commitment_error(contract_id: String, contract: Dictionary,
		input: Dictionary, commitment: Dictionary, current_slot: int) -> String:
	if commitment.account_id != contract.account_id \
			or commitment.source_id != contract_id \
			or int(commitment.created_slot) != int(contract.signed_slot) \
			or int(commitment.due_slot) != int(input.due_slot) \
			or int(commitment.amount_minor) != int(input.amount_minor) \
			or commitment.category != "payroll":
		return "Campaign payroll commitment disagrees with its employment terms."
	var terminated_slot = int(contract.terminated_slot)
	if terminated_slot >= 0 and int(commitment.due_slot) > terminated_slot:
		if commitment.status != "cancelled" \
				or int(commitment.resolution_slot) != terminated_slot:
			return "Terminated employment retains an uncancelled future payroll obligation."
	elif terminated_slot >= 0 and commitment.status != "settled":
		return "Employment termination did not settle payroll earned by its effective date."
	elif commitment.status == "cancelled":
		return "Campaign payroll was cancelled without terminating its employment term."
	if commitment.status == "settled" and int(commitment.due_slot) > current_slot:
		return "Campaign payroll settled before its contractual due date."
	return ""

static func _unowned_payroll_error(personnel: Dictionary, economy: Dictionary,
		indexed: Dictionary) -> String:
	for commitment_id in economy.commitments:
		var commitment: Dictionary = economy.commitments[commitment_id]
		if commitment.category != "payroll":
			continue
		if personnel.contracts.has(commitment.source_id):
			if commitment_id not in personnel.contracts[commitment.source_id].payroll_commitment_ids \
					or not indexed.has(commitment_id):
				return "Campaign economy contains payroll outside its employment schedule."
		else:
			return "Campaign economy contains payroll without one employment contract."
	return ""
