class_name CampaignPersonnel
extends RefCounted
## Campaign-owned people, employment, responsibilities and exclusive availability.
const KIND = "motorsport-manager-campaign-personnel"
const VERSION = 1
const MAX_PEOPLE = 512
const MAX_CONTRACTS = 1024
const MAX_ASSIGNMENTS = 2048
const MAX_RESERVATIONS = 8192

static func empty(campaign_id: String, organization_id: String,
		authority_from_slot: int = 0, legacy_payroll_ids: Array = []) -> Dictionary:
	if not CampaignIdentity.valid(campaign_id) or not CampaignIdentity.valid(organization_id) \
			or not RaceCheckpoint.integral(authority_from_slot, 0, CampaignClock.MAX_ELAPSED_SLOTS):
		return {}
	var data = {
		"kind": KIND,
		"version": VERSION,
		"campaign_id": campaign_id,
		"organization_id": organization_id,
		"authority_from_slot": authority_from_slot,
		"legacy_payroll_ids": legacy_payroll_ids.duplicate(true),
		"people": {},
		"contracts": {},
		"assignments": {},
		"reservations": {}
	}
	_seal(data)
	return data if validate(data).is_empty() else {}

static func register_person(current: Dictionary, input: Dictionary, created_slot: int) -> Dictionary:
	var data = current.duplicate(true)
	var error = validate(data)
	if not error.is_empty():
		return _reject(error, current)
	var person = CampaignPerson.build(input, created_slot)
	if person.is_empty() or data.people.has(person.get("id")) or data.people.size() >= MAX_PEOPLE:
		return _reject("Campaign person is invalid, duplicated or the registry is full.", current)
	data.people[person.id] = person
	return _validated(data, "registered", current)

static func sign_contract(current: Dictionary, input: Dictionary, signed_slot: int) -> Dictionary:
	var data = current.duplicate(true)
	var error = validate(data)
	if not error.is_empty():
		return _reject(error, current)
	var contract = CampaignEmploymentContract.build(input, signed_slot)
	if contract.is_empty() or not data.people.has(contract.get("person_id")) \
			or contract.get("account_id") != data.organization_id \
			or data.contracts.has(contract.get("id")) or data.contracts.size() >= MAX_CONTRACTS:
		return _reject("Campaign employment contract is invalid, duplicated or references an unknown person.", current)
	data.contracts[contract.id] = contract
	var result = _validated(data, "signed", current)
	if result.ok:
		result["payroll_inputs"] = CampaignEmploymentContract.payroll_inputs(contract)
		result["contract"] = contract.duplicate(true)
	return result

static func assign_role(current: Dictionary, input: Dictionary, created_slot: int) -> Dictionary:
	var data = current.duplicate(true)
	var error = validate(data)
	if not error.is_empty():
		return _reject(error, current)
	var assignment = CampaignRoleAssignment.build(input, created_slot)
	if assignment.is_empty() or data.assignments.has(assignment.get("id")) \
			or data.assignments.size() >= MAX_ASSIGNMENTS:
		return _reject("Campaign role assignment is invalid, duplicated or the registry is full.", current)
	if not data.contracts.has(assignment.contract_id):
		return _reject("Campaign role assignment references an unknown employment contract.", current)
	var contract: Dictionary = data.contracts[assignment.contract_id]
	var contract_status = CampaignEmploymentContract.status_at(contract, created_slot)
	if contract_status in ["unknown", "terminated", "expired"]:
		return _reject("Campaign role assignment requires binding employment at its creation slot.", current)
	data.assignments[assignment.id] = assignment
	return _validated(data, "assigned", current)

static func reserve_availability(current: Dictionary, input: Dictionary, created_slot: int) -> Dictionary:
	var data = current.duplicate(true)
	var error = validate(data)
	if not error.is_empty():
		return _reject(error, current)
	var reservation = CampaignAvailabilityReservation.build(input, created_slot)
	if reservation.is_empty() or data.reservations.has(reservation.get("id")) \
			or data.reservations.size() >= MAX_RESERVATIONS:
		return _reject("Campaign availability reservation is invalid, duplicated or the registry is full.", current)
	error = availability_error(
		data, reservation.person_id, int(reservation.start_slot), int(reservation.end_slot))
	if not error.is_empty():
		return _reject(error, current)
	data.reservations[reservation.id] = reservation
	return _validated(data, "reserved", current)

static func cancel_reservation(current: Dictionary, reservation_id: String, slot: int) -> Dictionary:
	var data = current.duplicate(true)
	var error = validate(data)
	if not error.is_empty():
		return _reject(error, current)
	if not data.reservations.has(reservation_id):
		return _reject("Campaign availability reservation is unknown.", current)
	var cancelled = CampaignAvailabilityReservation.cancel(data.reservations[reservation_id], slot)
	if cancelled.is_empty():
		return _reject("Campaign availability reservation can no longer be cancelled.", current)
	data.reservations[reservation_id] = cancelled
	return _validated(data, "reservation_cancelled", current)

static func terminate_contract(current: Dictionary, contract_id: String,
		slot: int, reason: String) -> Dictionary:
	var data = current.duplicate(true)
	var error = validate(data)
	if not error.is_empty():
		return _reject(error, current)
	if not data.contracts.has(contract_id):
		return _reject("Campaign employment contract is unknown.", current)
	var contract: Dictionary = data.contracts[contract_id]
	var status = CampaignEmploymentContract.status_at(contract, slot)
	if status in ["unknown", "terminated", "expired"] or not contract.successor_contract_id.is_empty():
		return _reject("Campaign employment contract cannot be terminated in its current state.", current)
	error = _active_reservation_error(data, contract_id, slot)
	if not error.is_empty():
		return _reject(error, current)
	var terminated = CampaignEmploymentContract.terminate(contract, slot, reason)
	if terminated.is_empty():
		return _reject("Campaign employment termination evidence is invalid.", current)
	data.contracts[contract_id] = terminated
	error = _release_future_reservations(data, contract_id, slot)
	if not error.is_empty():
		return _reject(error, current)
	var result = _validated(data, "terminated", current)
	if result.ok:
		result["cancel_commitment_ids"] = _future_payroll_ids(terminated, slot)
		result["contract"] = terminated.duplicate(true)
	return result

static func renew_contract(current: Dictionary, contract_id: String,
		input: Dictionary, signed_slot: int) -> Dictionary:
	var data = current.duplicate(true)
	var error = validate(data)
	if not error.is_empty():
		return _reject(error, current)
	if not data.contracts.has(contract_id):
		return _reject("Campaign employment contract is unknown.", current)
	var previous: Dictionary = data.contracts[contract_id]
	if CampaignEmploymentContract.status_at(previous, signed_slot) != "renewal_window" \
			or not previous.successor_contract_id.is_empty():
		return _reject("Campaign employment renewal is outside its declared window.", current)
	var terms = input.duplicate(true)
	terms["person_id"] = previous.person_id
	terms["account_id"] = previous.account_id
	terms["start_slot"] = previous.end_slot
	terms["predecessor_contract_id"] = previous.id
	var successor = CampaignEmploymentContract.build(terms, signed_slot)
	if successor.is_empty() or data.contracts.has(successor.get("id")) \
			or data.contracts.size() >= MAX_CONTRACTS:
		return _reject("Campaign employment renewal terms are invalid or duplicated.", current)
	var linked = CampaignEmploymentContract.with_successor(previous, successor.id)
	if linked.is_empty():
		return _reject("Campaign employment renewal could not link its predecessor.", current)
	data.contracts[contract_id] = linked
	data.contracts[successor.id] = successor
	var result = _validated(data, "renewed", current)
	if result.ok:
		result["payroll_inputs"] = CampaignEmploymentContract.payroll_inputs(successor)
		result["contract"] = successor.duplicate(true)
	return result

static func availability_error(data: Dictionary, person_id: String,
		start_slot: int, end_slot: int) -> String:
	var error = validate(data)
	if not error.is_empty():
		return error
	if not data.people.has(person_id) or start_slot < 0 or end_slot <= start_slot \
			or end_slot > CampaignClock.MAX_ELAPSED_SLOTS:
		return "Campaign availability request is invalid."
	var covered = false
	for contract in data.contracts.values():
		if contract.person_id == person_id and int(contract.start_slot) <= start_slot \
				and end_slot <= CampaignEmploymentContract.effective_end(contract):
			covered = true
			break
	if not covered:
		return "Campaign person has no effective employment covering the requested interval."
	var probe = {"start_slot": start_slot, "end_slot": end_slot}
	for reservation in data.reservations.values():
		if reservation.status == "active" and reservation.person_id == person_id \
				and CampaignAvailabilityReservation.overlaps(reservation, probe):
			return "Campaign person is already committed during the requested interval."
	return ""

static func contract_status(data: Dictionary, contract_id: String, slot: int) -> String:
	if not validate(data).is_empty() or not data.contracts.has(contract_id):
		return "unknown"
	return CampaignEmploymentContract.status_at(data.contracts[contract_id], slot)

static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign personnel exceeds serialized-value limits."
	if not data is Dictionary or data.size() != 11 or data.get("kind") != KIND:
		return "Unsupported campaign personnel projection."
	var error = _header_error(data)
	if not error.is_empty():
		return error
	error = _people_error(data)
	if not error.is_empty():
		return error
	error = _contracts_error(data)
	if not error.is_empty():
		return error
	error = _assignments_error(data)
	if not error.is_empty():
		return error
	error = _reservations_error(data)
	if not error.is_empty():
		return error
	error = CampaignPersonnelRules.validate_collections(data)
	if not error.is_empty():
		return error
	return _integrity_error(data)

static func _header_error(data: Dictionary) -> String:
	if not RaceCheckpoint.integral(data.get("version"), VERSION, VERSION) \
			or not CampaignIdentity.valid(data.get("campaign_id")) \
			or not CampaignIdentity.valid(data.get("organization_id")) \
			or not RaceCheckpoint.integral(
				data.get("authority_from_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS):
		return "Campaign personnel version, identity or authority is invalid."
	if not data.get("legacy_payroll_ids") is Array \
			or data.legacy_payroll_ids.size() > CampaignEconomy.MAX_COMMITMENTS:
		return "Campaign personnel legacy payroll index is invalid."
	var seen = {}
	for commitment_id in data.legacy_payroll_ids:
		if not CampaignIdentity.valid(commitment_id) or seen.has(commitment_id):
			return "Campaign personnel legacy payroll identity is invalid or duplicated."
		seen[commitment_id] = true
	if not data.get("people") is Dictionary or data.people.size() > MAX_PEOPLE \
			or not data.get("contracts") is Dictionary or data.contracts.size() > MAX_CONTRACTS \
			or not data.get("assignments") is Dictionary or data.assignments.size() > MAX_ASSIGNMENTS \
			or not data.get("reservations") is Dictionary or data.reservations.size() > MAX_RESERVATIONS:
		return "Campaign personnel collections are invalid."
	return ""

static func _people_error(data: Dictionary) -> String:
	for person_id in data.people:
		if person_id != data.people[person_id].get("id"):
			return "Campaign person key disagrees with its identity."
		var error = CampaignPerson.validate(data.people[person_id])
		if not error.is_empty():
			return error
	return ""

static func _contracts_error(data: Dictionary) -> String:
	for contract_id in data.contracts:
		if contract_id != data.contracts[contract_id].get("id"):
			return "Campaign employment contract key disagrees with its identity."
		var error = CampaignEmploymentContract.validate(data.contracts[contract_id])
		if not error.is_empty():
			return error
	return ""

static func _assignments_error(data: Dictionary) -> String:
	for assignment_id in data.assignments:
		if assignment_id != data.assignments[assignment_id].get("id"):
			return "Campaign role assignment key disagrees with its identity."
		var error = CampaignRoleAssignment.validate(data.assignments[assignment_id])
		if not error.is_empty():
			return error
	return ""

static func _reservations_error(data: Dictionary) -> String:
	for reservation_id in data.reservations:
		if reservation_id != data.reservations[reservation_id].get("id"):
			return "Campaign availability reservation key disagrees with its identity."
		var error = CampaignAvailabilityReservation.validate(data.reservations[reservation_id])
		if not error.is_empty():
			return error
	return ""

static func _integrity_error(data: Dictionary) -> String:
	var content = data.duplicate(true)
	content.erase("digest")
	if not CampaignIdentity.valid_hash(data.get("digest")) \
			or data.digest != RaceStateValue.fingerprint(content):
		return "Campaign personnel integrity check failed."
	return ""

static func _active_reservation_error(data: Dictionary, contract_id: String, slot: int) -> String:
	for reservation in data.reservations.values():
		if reservation.status != "active" or not data.assignments.has(reservation.assignment_id):
			continue
		var assignment: Dictionary = data.assignments[reservation.assignment_id]
		if assignment.contract_id == contract_id and int(reservation.start_slot) < slot \
				and slot < int(reservation.end_slot):
			return "Campaign employment cannot end during an active availability reservation."
	return ""

static func _release_future_reservations(data: Dictionary, contract_id: String, slot: int) -> String:
	for reservation_id in data.reservations:
		var reservation: Dictionary = data.reservations[reservation_id]
		if reservation.status != "active" or int(reservation.start_slot) < slot:
			continue
		var assignment: Dictionary = data.assignments.get(reservation.assignment_id, {})
		if assignment.get("contract_id") != contract_id:
			continue
		var cancelled = CampaignAvailabilityReservation.cancel(reservation, slot)
		if cancelled.is_empty():
			return "Future availability could not be released with the employment contract."
		data.reservations[reservation_id] = cancelled
	return ""

static func _future_payroll_ids(contract: Dictionary, slot: int) -> Array:
	var result: Array = []
	for input in CampaignEmploymentContract.payroll_inputs(contract):
		if int(input.due_slot) > slot:
			result.append(input.id)
	return result

static func _validated(data: Dictionary, status: String, current: Dictionary) -> Dictionary:
	_seal(data)
	var error = validate(data)
	return {
		"ok": error.is_empty(),
		"status": status if error.is_empty() else "rejected",
		"error": error,
		"personnel": data if error.is_empty() else current.duplicate(true)
	}

static func _reject(message: String, current: Dictionary, status: String = "rejected") -> Dictionary:
	return {"ok": false, "status": status, "error": message,
		"personnel": current.duplicate(true)}

static func _seal(data: Dictionary) -> void:
	data.erase("digest")
	data["digest"] = RaceStateValue.fingerprint(data)
