class_name CampaignOperationsTimeline
extends RefCounted
## Operations history cannot be dated after authoritative campaign time.


static func validate(operations: Dictionary, elapsed_slot: int) -> String:
	var error = CampaignOperations.validate(operations)
	if not error.is_empty():
		return error
	if not RaceCheckpoint.integral(elapsed_slot, 0, CampaignClock.MAX_ELAPSED_SLOTS):
		return "Campaign operations has no valid authoritative time boundary."
	if int(operations.authority_from_slot) > elapsed_slot:
		return "Campaign operations authority begins after authoritative campaign time."
	for resource in operations.resources.values():
		if int(resource.created_slot) > elapsed_slot:
			return "Campaign capacity resource was created after authoritative campaign time."
	for order in operations.work_orders.values():
		if int(order.created_slot) > elapsed_slot or int(order.cancellation_slot) > elapsed_slot:
			return "Campaign work-order history is dated after authoritative campaign time."
	for reservation in operations.capacity_reservations.values():
		if (
			int(reservation.created_slot) > elapsed_slot
			or int(reservation.cancellation_slot) > elapsed_slot
		):
			return "Campaign capacity-reservation history is dated after authoritative campaign time."
	return ""
