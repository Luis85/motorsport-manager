class_name CampaignPersonnelRules
extends RefCounted
## Cross-record validation for contracts, roles and exclusive availability.


static func validate_collections(data: Dictionary) -> String:
	var error = _contract_reference_error(data)
	if not error.is_empty():
		return error
	error = _contract_lineage_error(data)
	if not error.is_empty():
		return error
	error = _contract_overlap_error(data)
	if not error.is_empty():
		return error
	error = _assignment_reference_error(data)
	if not error.is_empty():
		return error
	error = _assignment_capacity_error(data)
	if not error.is_empty():
		return error
	error = _reservation_reference_error(data)
	if not error.is_empty():
		return error
	return _reservation_overlap_error(data)


static func _contract_reference_error(data: Dictionary) -> String:
	for person in data.people.values():
		if int(person.created_slot) < int(data.authority_from_slot):
			return "Campaign person predates personnel authority."
	for contract in data.contracts.values():
		if not data.people.has(contract.person_id) or contract.account_id != data.organization_id:
			return "Campaign employment contract references an unknown person or account."
		if (
			int(contract.signed_slot) < int(data.people[contract.person_id].created_slot)
			or int(contract.signed_slot) < int(data.authority_from_slot)
		):
			return "Campaign employment contract predates its person record or personnel authority."
	return ""


static func _contract_lineage_error(data: Dictionary) -> String:
	for contract_id in data.contracts:
		var contract: Dictionary = data.contracts[contract_id]
		var predecessor_id: String = contract.predecessor_contract_id
		if not predecessor_id.is_empty():
			var error = _predecessor_error(data, contract_id, contract, predecessor_id)
			if not error.is_empty():
				return error
		var successor_id: String = contract.successor_contract_id
		if not successor_id.is_empty():
			var error = _successor_error(data, contract_id, contract, successor_id)
			if not error.is_empty():
				return error
	return ""


static func _predecessor_error(
	data: Dictionary, contract_id: String, contract: Dictionary, predecessor_id: String
) -> String:
	if not data.contracts.has(predecessor_id):
		return "Campaign contract predecessor is missing."
	var predecessor: Dictionary = data.contracts[predecessor_id]
	if (
		predecessor.person_id != contract.person_id
		or predecessor.account_id != contract.account_id
		or predecessor.successor_contract_id != contract_id
		or int(predecessor.end_slot) != int(contract.start_slot)
	):
		return "Campaign contract renewal chain is inconsistent."
	return ""


static func _successor_error(
	data: Dictionary, contract_id: String, contract: Dictionary, successor_id: String
) -> String:
	if not data.contracts.has(successor_id):
		return "Campaign contract successor is missing."
	var successor: Dictionary = data.contracts[successor_id]
	if (
		successor.predecessor_contract_id != contract_id
		or successor.person_id != contract.person_id
		or successor.account_id != contract.account_id
		or int(successor.start_slot) != int(contract.end_slot)
	):
		return "Campaign contract successor chain is inconsistent."
	return ""


static func _contract_overlap_error(data: Dictionary) -> String:
	var by_person = {}
	for contract in data.contracts.values():
		if not by_person.has(contract.person_id):
			by_person[contract.person_id] = []
		by_person[contract.person_id].append(contract)
	for contracts in by_person.values():
		for left_index in range(contracts.size()):
			var left: Dictionary = contracts[left_index]
			var left_end = CampaignEmploymentContract.effective_end(left)
			for right_index in range(left_index + 1, contracts.size()):
				var right: Dictionary = contracts[right_index]
				var right_end = CampaignEmploymentContract.effective_end(right)
				if int(left.start_slot) < right_end and int(right.start_slot) < left_end:
					return "Campaign person has overlapping employment contracts."
	return ""


static func _assignment_reference_error(data: Dictionary) -> String:
	for assignment in data.assignments.values():
		if (
			not data.people.has(assignment.person_id)
			or not data.contracts.has(assignment.contract_id)
		):
			return "Campaign role assignment references an unknown person or contract."
		var person: Dictionary = data.people[assignment.person_id]
		var contract: Dictionary = data.contracts[assignment.contract_id]
		var contract_status = CampaignEmploymentContract.status_at(
			contract, int(assignment.created_slot)
		)
		if (
			contract.person_id != assignment.person_id
			or assignment.role_id not in person.eligible_roles
			or int(assignment.created_slot) < int(contract.signed_slot)
			or contract_status in ["unknown", "terminated", "expired"]
			or int(assignment.start_slot) < int(contract.start_slot)
			or int(assignment.end_slot) > int(contract.end_slot)
		):
			return "Campaign role assignment is outside its person, eligibility or contract terms."
	return ""


static func _assignment_capacity_error(data: Dictionary) -> String:
	var by_contract = {}
	for assignment in data.assignments.values():
		if not by_contract.has(assignment.contract_id):
			by_contract[assignment.contract_id] = []
		by_contract[assignment.contract_id].append(assignment)
	for contract_id in by_contract:
		var contract: Dictionary = data.contracts[contract_id]
		var assignments: Array = by_contract[contract_id]
		var error = _duplicate_role_error(contract, assignments)
		if not error.is_empty():
			return error
		error = _allocation_error(contract, assignments)
		if not error.is_empty():
			return error
	return ""


static func _duplicate_role_error(contract: Dictionary, assignments: Array) -> String:
	var effective_end = CampaignEmploymentContract.effective_end(contract)
	for left_index in range(assignments.size()):
		var left: Dictionary = assignments[left_index]
		var left_end = mini(int(left.end_slot), effective_end)
		for right_index in range(left_index + 1, assignments.size()):
			var right: Dictionary = assignments[right_index]
			var right_end = mini(int(right.end_slot), effective_end)
			if (
				left.role_id == right.role_id
				and CampaignRoleAssignment.overlaps(left, right, left_end, right_end)
			):
				return "Campaign person has duplicate overlapping responsibility for one role."
	return ""


static func _allocation_error(contract: Dictionary, assignments: Array) -> String:
	var boundaries: Array = []
	var effective_end = CampaignEmploymentContract.effective_end(contract)
	for assignment in assignments:
		var end_slot = mini(int(assignment.end_slot), effective_end)
		if end_slot > int(assignment.start_slot):
			boundaries.append(int(assignment.start_slot))
			boundaries.append(end_slot)
	for slot in boundaries:
		var allocation = 0
		for assignment in assignments:
			var end_slot = mini(int(assignment.end_slot), effective_end)
			if int(assignment.start_slot) <= int(slot) and int(slot) < end_slot:
				allocation += int(assignment.allocation_bps)
		if allocation > int(contract.capacity_bps):
			return "Campaign role allocations exceed the person's contracted capacity."
	return ""


static func _reservation_reference_error(data: Dictionary) -> String:
	for reservation in data.reservations.values():
		if not data.assignments.has(reservation.assignment_id):
			return "Campaign availability reservation references an unknown assignment."
		var assignment: Dictionary = data.assignments[reservation.assignment_id]
		if (
			assignment.person_id != reservation.person_id
			or int(reservation.created_slot) < int(assignment.created_slot)
			or int(reservation.start_slot) < int(assignment.start_slot)
			or int(reservation.end_slot) > int(assignment.end_slot)
		):
			return "Campaign availability reservation is outside its role assignment."
		if reservation.status == "active":
			var contract: Dictionary = data.contracts[assignment.contract_id]
			if int(reservation.end_slot) > CampaignEmploymentContract.effective_end(contract):
				return "Active campaign availability extends beyond effective employment."
	return ""


static func _reservation_overlap_error(data: Dictionary) -> String:
	var active_by_person = {}
	for reservation in data.reservations.values():
		if reservation.status != "active":
			continue
		if not active_by_person.has(reservation.person_id):
			active_by_person[reservation.person_id] = []
		active_by_person[reservation.person_id].append(reservation)
	for reservations in active_by_person.values():
		for left_index in range(reservations.size()):
			for right_index in range(left_index + 1, reservations.size()):
				if CampaignAvailabilityReservation.overlaps(
					reservations[left_index], reservations[right_index]
				):
					return "Campaign person is assigned to overlapping work, travel, training or leave."
	return ""
