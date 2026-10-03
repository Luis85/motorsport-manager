class_name CampaignOperationsPersonnel
extends RefCounted
## Internal work consumes the same exclusive people reservations as all other work.


static func validate(operations: Dictionary, personnel: Dictionary) -> String:
	var error = CampaignOperations.validate(operations)
	if not error.is_empty():
		return error
	error = CampaignPersonnel.validate(personnel)
	if not error.is_empty():
		return error
	if (
		operations.campaign_id != personnel.campaign_id
		or operations.organization_id != personnel.organization_id
	):
		return "Campaign operations and personnel belong to different organizations."
	var indexed = {}
	for order in operations.work_orders.values():
		if order.mode == "rented_service":
			continue
		for index in range(order.assignment_ids.size()):
			var assignment_id: String = order.assignment_ids[index]
			var reservation_id: String = order.personnel_reservation_ids[index]
			if (
				reservation_id
				!= CampaignWorkOrder.personnel_reservation_id(order.id, assignment_id)
			):
				return "Campaign internal work has a non-deterministic personnel reservation identity."
			if (
				not personnel.assignments.has(assignment_id)
				or not personnel.reservations.has(reservation_id)
				or indexed.has(reservation_id)
			):
				return "Campaign internal work has a missing or duplicated personnel reservation."
			var assignment: Dictionary = personnel.assignments[assignment_id]
			var reservation: Dictionary = personnel.reservations[reservation_id]
			if (
				reservation.assignment_id != assignment_id
				or reservation.person_id != assignment.person_id
				or reservation.kind != "factory_work"
				or reservation.location_id != order.resource_id
				or int(reservation.start_slot) != int(order.start_slot)
				or int(reservation.end_slot) != int(order.end_slot)
			):
				return "Campaign internal work personnel evidence disagrees with its work order."
			if order.status == "scheduled" and reservation.status != "active":
				return "Scheduled campaign internal work lost its personnel reservation."
			if (
				order.status == "cancelled"
				and (
					reservation.status != "cancelled"
					or int(reservation.cancellation_slot) != int(order.cancellation_slot)
				)
			):
				return "Cancelled campaign internal work did not release personnel at the same slot."
			indexed[reservation_id] = true
	for reservation_id in personnel.reservations:
		var reservation: Dictionary = personnel.reservations[reservation_id]
		if (
			reservation.kind == "factory_work"
			and operations.resources.has(reservation.location_id)
			and int(reservation.created_slot) >= int(operations.authority_from_slot)
			and reservation_id not in indexed
		):
			return "Campaign facility work exists outside one operations work order."
	return ""
