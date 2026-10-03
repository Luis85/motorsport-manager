class_name CampaignOperationsQuery
extends RefCounted
## Detached read models for internal capacity and rented alternatives.


static func capacity_options(
	checkpoint: Dictionary, family: String, start_slot: int, end_slot: int, units: int
) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return {"ok": false, "error": restored.error, "options": []}
	if family not in CampaignCapacityResource.FAMILIES or end_slot <= start_slot or units < 1:
		return {"ok": false, "error": "Campaign capacity query is invalid.", "options": []}
	var options: Array = []
	for resource_id in restored.operations.resources:
		var resource: Dictionary = restored.operations.resources[resource_id]
		if resource.family != family:
			continue
		var error = CampaignOperations.availability_error(
			restored.operations, resource_id, start_slot, end_slot, units
		)
		var quoted = 0
		if resource.access == "service" and error.is_empty():
			quoted = CampaignCapacityResource.quote_minor(resource, start_slot, end_slot, units)
		options.append(
			{
				"resource_id": resource_id,
				"display_name": resource.display_name,
				"access": resource.access,
				"available": error.is_empty(),
				"reason": error,
				"quoted_cost_minor": quoted
			}
		)
	options.sort_custom(
		func(left, right):
			if left.access != right.access:
				return left.access < right.access
			return left.resource_id < right.resource_id
	)
	return {
		"ok": true, "error": "", "options": options, "source_digest": restored.operations.digest
	}


static func work_order(checkpoint: Dictionary, order_id: String) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok or not restored.operations.work_orders.has(order_id):
		return {}
	var order: Dictionary = restored.operations.work_orders[order_id].duplicate(true)
	order["derived_state"] = CampaignWorkOrder.state_at(order, restored.state.clock.elapsed_slots)
	return order
