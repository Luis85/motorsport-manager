class_name CampaignOperationsTransaction
extends RefCounted
## Atomic facilities/capacity boundary. Planning freezes during active weekends.

static func register_owned(checkpoint: Dictionary, input: Dictionary) -> Dictionary:
	var data = input.duplicate(true)
	data["access"] = "owned"
	data["rate_minor_per_unit_slot"] = 0
	return _register_resource(checkpoint, data)

static func register_service(checkpoint: Dictionary, input: Dictionary) -> Dictionary:
	var data = input.duplicate(true)
	data["access"] = "service"
	return _register_resource(checkpoint, data)

static func schedule_internal(checkpoint: Dictionary, input: Dictionary) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok:
		return restored
	var resource_id: String = str(input.get("resource_id", ""))
	if not restored.operations.resources.has(resource_id) \
			or restored.operations.resources[resource_id].access != "owned":
		return _reject("Internal work requires one registered owned facility.", checkpoint)
	var assignment_ids = input.get("assignment_ids", [])
	if not assignment_ids is Array or assignment_ids.is_empty():
		return _reject("Internal work requires at least one personnel assignment.", checkpoint)
	var slot = restored.state.clock.elapsed_slots
	var order_input = _base_order_input(input, "internal")
	order_input["assignment_ids"] = assignment_ids.duplicate(true)
	order_input["commitment_ids"] = []
	order_input["quoted_cost_minor"] = 0
	var personnel = restored.personnel.duplicate(true)
	var reservation_ids: Array = []
	for assignment_id in assignment_ids:
		if not personnel.assignments.has(assignment_id):
			return _reject("Internal work references an unknown personnel assignment.", checkpoint)
		var assignment: Dictionary = personnel.assignments[assignment_id]
		var reservation_id = CampaignWorkOrder.personnel_reservation_id(order_input.id, assignment_id)
		var reserved = CampaignPersonnel.reserve_availability(personnel, {
			"id": reservation_id,
			"person_id": assignment.person_id,
			"assignment_id": assignment_id,
			"start_slot": order_input.start_slot,
			"end_slot": order_input.end_slot,
			"kind": "factory_work",
			"location_id": resource_id
		}, slot)
		if not reserved.ok:
			return _reject(reserved.error, checkpoint)
		personnel = reserved.personnel
		reservation_ids.append(reservation_id)
	order_input["personnel_reservation_ids"] = reservation_ids
	var changed = CampaignOperations.schedule(restored.operations, order_input, slot)
	if not changed.ok:
		return _reject(changed.error, checkpoint, changed.status)
	return _publish(restored, changed.operations, personnel, restored.economy,
		changed.status, checkpoint)

static func schedule_service(checkpoint: Dictionary, input: Dictionary) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok:
		return restored
	var resource_id: String = str(input.get("resource_id", ""))
	if not restored.operations.resources.has(resource_id):
		return _reject("Rented work references an unknown service resource.", checkpoint)
	var resource: Dictionary = restored.operations.resources[resource_id]
	if resource.access != "service":
		return _reject("Rented work requires one external service resource.", checkpoint)
	var slot = restored.state.clock.elapsed_slots
	var order_input = _base_order_input(input, "rented_service")
	order_input["assignment_ids"] = []
	order_input["personnel_reservation_ids"] = []
	var quote = CampaignCapacityResource.quote_minor(
		resource, int(order_input.start_slot), int(order_input.end_slot), int(order_input.units))
	if quote <= 0:
		return _reject("Rented service cannot produce a valid bounded quote.", checkpoint)
	var commitment_id = CampaignWorkOrder.commitment_id(order_input.id)
	order_input["commitment_ids"] = [commitment_id]
	order_input["quoted_cost_minor"] = quote
	var changed = CampaignOperations.schedule(restored.operations, order_input, slot)
	if not changed.ok:
		return _reject(changed.error, checkpoint, changed.status)
	var economy = CampaignEconomy.add_commitment(restored.economy, {
		"id": commitment_id,
		"account_id": restored.state.organization_id,
		"source_id": order_input.id,
		"due_slot": order_input.start_slot,
		"amount_minor": -quote,
		"category": "facility"
	}, slot)
	if not economy.ok:
		return _reject(economy.error, checkpoint)
	return _publish(restored, changed.operations, restored.personnel, economy.economy,
		changed.status, checkpoint)

static func cancel_work_order(checkpoint: Dictionary, order_id: String) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok:
		return restored
	var slot = restored.state.clock.elapsed_slots
	var changed = CampaignOperations.cancel(restored.operations, order_id, slot)
	if not changed.ok:
		return _reject(changed.error, checkpoint, changed.status)
	var order: Dictionary = changed.order
	var personnel = restored.personnel.duplicate(true)
	for reservation_id in order.personnel_reservation_ids:
		var released = CampaignPersonnel.cancel_reservation(personnel, reservation_id, slot)
		if not released.ok:
			return _reject(released.error, checkpoint)
		personnel = released.personnel
	var economy = restored.economy.duplicate(true)
	for commitment_id in order.commitment_ids:
		var cancelled = CampaignEconomy.cancel_commitment(economy, commitment_id, slot)
		if not cancelled.ok:
			return _reject(cancelled.error, checkpoint)
		economy = cancelled.economy
	return _publish(restored, changed.operations, personnel, economy,
		changed.status, checkpoint)

static func _register_resource(checkpoint: Dictionary, input: Dictionary) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok:
		return restored
	var changed = CampaignOperations.register_resource(
		restored.operations, input, restored.state.clock.elapsed_slots)
	if not changed.ok:
		return _reject(changed.error, checkpoint, changed.status)
	return _publish(restored, changed.operations, restored.personnel, restored.economy,
		changed.status, checkpoint)

static func _restore(checkpoint: Dictionary) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return _reject(restored.error, checkpoint)
	if not restored.active_manifest.is_empty():
		return _reject("Operations planning is frozen while a campaign weekend is active.", checkpoint)
	return restored

static func _base_order_input(input: Dictionary, mode: String) -> Dictionary:
	return {
		"id": input.get("id"),
		"mode": mode,
		"family": input.get("family"),
		"resource_id": input.get("resource_id"),
		"start_slot": input.get("start_slot"),
		"end_slot": input.get("end_slot"),
		"units": input.get("units"),
		"capacity_reservation_id": CampaignWorkOrder.capacity_reservation_id(str(input.get("id", "")))
	}

static func _publish(restored: Dictionary, operations: Dictionary, personnel: Dictionary,
		economy: Dictionary, status: String, original: Dictionary) -> Dictionary:
	var candidate = CampaignCheckpoint.build(
		restored.state, restored.settlements, restored.active_manifest,
		restored.competition, economy, restored.inventory, personnel, operations)
	if candidate.is_empty():
		return _reject("Operations change could not form one valid campaign checkpoint.", original)
	return {"ok": true, "status": status, "error": "", "checkpoint": candidate}

static func _reject(message: String, checkpoint: Dictionary,
		status: String = "rejected") -> Dictionary:
	return {"ok": false, "status": status, "error": message,
		"checkpoint": checkpoint.duplicate(true)}
