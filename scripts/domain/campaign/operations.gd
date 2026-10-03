class_name CampaignOperations
extends RefCounted
## Campaign-owned facility/service capacity and scheduled work authority.
const KIND = "motorsport-manager-campaign-operations"
const VERSION = 1
const MAX_RESOURCES = 256
const MAX_ORDERS = 4096
const MAX_RESERVATIONS = 4096


static func empty(
	campaign_id: String,
	organization_id: String,
	authority_from_slot: int = 0,
	legacy_facility_commitment_ids: Array = []
) -> Dictionary:
	if (
		not CampaignIdentity.valid(campaign_id)
		or not CampaignIdentity.valid(organization_id)
		or not RaceCheckpoint.integral(authority_from_slot, 0, CampaignClock.MAX_ELAPSED_SLOTS)
	):
		return {}
	var data = {
		"kind": KIND,
		"version": VERSION,
		"campaign_id": campaign_id,
		"organization_id": organization_id,
		"authority_from_slot": authority_from_slot,
		"legacy_facility_commitment_ids": legacy_facility_commitment_ids.duplicate(true),
		"resources": {},
		"work_orders": {},
		"capacity_reservations": {}
	}
	_seal(data)
	return data if validate(data).is_empty() else {}


static func register_resource(
	current: Dictionary, input: Dictionary, created_slot: int
) -> Dictionary:
	var data = current.duplicate(true)
	var error = validate(data)
	if not error.is_empty():
		return _reject(error, current)
	var resource = CampaignCapacityResource.build(input, created_slot)
	if (
		resource.is_empty()
		or data.resources.has(resource.get("id"))
		or data.resources.size() >= MAX_RESOURCES
	):
		return _reject(
			"Campaign capacity resource is invalid, duplicated or the registry is full.", current
		)
	data.resources[resource.id] = resource
	return _validated(data, "resource_registered", current)


static func schedule(current: Dictionary, input: Dictionary, created_slot: int) -> Dictionary:
	var data = current.duplicate(true)
	var error = validate(data)
	if not error.is_empty():
		return _reject(error, current)
	var order = CampaignWorkOrder.build(input, created_slot)
	if (
		order.is_empty()
		or data.work_orders.has(order.get("id"))
		or data.work_orders.size() >= MAX_ORDERS
	):
		return _reject(
			"Campaign work order is invalid, duplicated or the registry is full.", current
		)
	if not data.resources.has(order.resource_id):
		return _reject("Campaign work order references an unknown capacity resource.", current)
	var resource: Dictionary = data.resources[order.resource_id]
	error = _order_resource_error(order, resource)
	if not error.is_empty():
		return _reject(error, current)
	var reservation = CampaignCapacityReservation.build(
		{
			"id": order.capacity_reservation_id,
			"work_order_id": order.id,
			"resource_id": order.resource_id,
			"start_slot": order.start_slot,
			"end_slot": order.end_slot,
			"units": order.units
		},
		created_slot
	)
	if (
		reservation.is_empty()
		or data.capacity_reservations.has(reservation.get("id"))
		or data.capacity_reservations.size() >= MAX_RESERVATIONS
	):
		return _reject(
			"Campaign work capacity reservation is invalid, duplicated or full.", current
		)
	data.work_orders[order.id] = order
	data.capacity_reservations[reservation.id] = reservation
	return _validated(data, "scheduled", current)


static func cancel(current: Dictionary, order_id: String, slot: int) -> Dictionary:
	var data = current.duplicate(true)
	var error = validate(data)
	if not error.is_empty():
		return _reject(error, current)
	if not data.work_orders.has(order_id):
		return _reject("Campaign work order is unknown.", current)
	var order = CampaignWorkOrder.cancel(data.work_orders[order_id], slot)
	if order.is_empty():
		return _reject("Campaign work order can no longer be cancelled.", current)
	var reservation_id: String = order.capacity_reservation_id
	var reservation = CampaignCapacityReservation.cancel(
		data.capacity_reservations[reservation_id], slot
	)
	if reservation.is_empty():
		return _reject("Campaign capacity reservation could not be released.", current)
	data.work_orders[order_id] = order
	data.capacity_reservations[reservation_id] = reservation
	var result = _validated(data, "cancelled", current)
	if result.ok:
		result["order"] = order.duplicate(true)
	return result


static func availability_error(
	data: Dictionary, resource_id: String, start_slot: int, end_slot: int, units: int
) -> String:
	var error = validate(data)
	if not error.is_empty():
		return error
	if not data.resources.has(resource_id) or units < 1 or end_slot <= start_slot:
		return "Campaign capacity request is invalid."
	var resource: Dictionary = data.resources[resource_id]
	if (
		start_slot < int(resource.available_from_slot)
		or end_slot > int(resource.available_until_slot)
		or units > int(resource.capacity_units)
	):
		return "Campaign capacity request is outside resource availability."
	var probe = {"start_slot": start_slot, "end_slot": end_slot}
	var boundaries: Array = [start_slot]
	for reservation in data.capacity_reservations.values():
		if (
			reservation.status == "active"
			and reservation.resource_id == resource_id
			and CampaignCapacityReservation.overlaps(reservation, probe)
		):
			boundaries.append(maxi(start_slot, int(reservation.start_slot)))
	for boundary in boundaries:
		var used = units
		for reservation in data.capacity_reservations.values():
			if (
				reservation.status == "active"
				and reservation.resource_id == resource_id
				and int(reservation.start_slot) <= boundary
				and boundary < int(reservation.end_slot)
			):
				used += int(reservation.units)
		if used > int(resource.capacity_units):
			return "Campaign capacity is already fully allocated during the requested interval."
	return ""


static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign operations exceeds serialized-value limits."
	if not data is Dictionary or data.size() != 10 or data.get("kind") != KIND:
		return "Unsupported campaign operations projection."
	if (
		not RaceCheckpoint.integral(data.get("version"), VERSION, VERSION)
		or not CampaignIdentity.valid(data.get("campaign_id"))
		or not CampaignIdentity.valid(data.get("organization_id"))
		or not RaceCheckpoint.integral(
			data.get("authority_from_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS
		)
	):
		return "Campaign operations version, identity or authority is invalid."
	if (
		not data.get("legacy_facility_commitment_ids") is Array
		or data.legacy_facility_commitment_ids.size() > CampaignEconomy.MAX_COMMITMENTS
		or not data.get("resources") is Dictionary
		or data.resources.size() > MAX_RESOURCES
		or not data.get("work_orders") is Dictionary
		or data.work_orders.size() > MAX_ORDERS
		or not data.get("capacity_reservations") is Dictionary
		or data.capacity_reservations.size() > MAX_RESERVATIONS
	):
		return "Campaign operations collections are invalid."
	var error = _records_error(data)
	if not error.is_empty():
		return error
	error = _capacity_error(data)
	if not error.is_empty():
		return error
	return _integrity_error(data)


static func _records_error(data: Dictionary) -> String:
	var legacy_seen = {}
	for commitment_id in data.legacy_facility_commitment_ids:
		if not CampaignIdentity.valid(commitment_id) or legacy_seen.has(commitment_id):
			return "Campaign operations legacy facility commitment index is invalid."
		legacy_seen[commitment_id] = true
	for resource_id in data.resources:
		if (
			not data.resources[resource_id] is Dictionary
			or resource_id != data.resources[resource_id].get("id")
			or not CampaignCapacityResource.validate(data.resources[resource_id]).is_empty()
			or int(data.resources[resource_id].created_slot) < int(data.authority_from_slot)
		):
			return "Campaign operations contains an invalid capacity resource."
	for order_id in data.work_orders:
		var order = data.work_orders[order_id]
		if (
			not order is Dictionary
			or order_id != order.get("id")
			or not CampaignWorkOrder.validate(order).is_empty()
			or not data.resources.has(order.get("resource_id"))
			or not data.capacity_reservations.has(order.get("capacity_reservation_id"))
			or int(order.created_slot) < int(data.authority_from_slot)
		):
			return "Campaign operations contains an invalid work order."
		var error = _order_resource_error(order, data.resources[order.resource_id])
		if not error.is_empty():
			return error
	for reservation_id in data.capacity_reservations:
		var reservation = data.capacity_reservations[reservation_id]
		if (
			not reservation is Dictionary
			or reservation_id != reservation.get("id")
			or not CampaignCapacityReservation.validate(reservation).is_empty()
			or not data.work_orders.has(reservation.get("work_order_id"))
		):
			return "Campaign operations contains an invalid capacity reservation."
		var order: Dictionary = data.work_orders[reservation.work_order_id]
		var reservation_status = "active" if order.status == "scheduled" else "cancelled"
		if (
			order.capacity_reservation_id != reservation_id
			or order.resource_id != reservation.resource_id
			or int(order.created_slot) != int(reservation.created_slot)
			or int(order.start_slot) != int(reservation.start_slot)
			or int(order.end_slot) != int(reservation.end_slot)
			or int(order.units) != int(reservation.units)
			or reservation.status != reservation_status
			or int(order.cancellation_slot) != int(reservation.cancellation_slot)
		):
			return "Campaign work order and capacity reservation disagree."
	return ""


static func _order_resource_error(order: Dictionary, resource: Dictionary) -> String:
	if (
		order.family != resource.family
		or (order.mode == "internal" and resource.access != "owned")
		or (order.mode == "rented_service" and resource.access != "service")
	):
		return "Campaign work order uses an incompatible capacity resource."
	if (
		int(order.start_slot) < int(resource.available_from_slot)
		or int(order.end_slot) > int(resource.available_until_slot)
		or int(order.units) > int(resource.capacity_units)
	):
		return "Campaign work order lies outside capacity availability."
	if order.mode == "rented_service":
		var quoted = CampaignCapacityResource.quote_minor(
			resource, int(order.start_slot), int(order.end_slot), int(order.units)
		)
		if quoted != int(order.quoted_cost_minor):
			return "Campaign rented-service quote disagrees with its resource rate."
	return ""


static func _capacity_error(data: Dictionary) -> String:
	for resource_id in data.resources:
		var resource: Dictionary = data.resources[resource_id]
		var boundaries: Array = []
		for reservation in data.capacity_reservations.values():
			if reservation.status == "active" and reservation.resource_id == resource_id:
				boundaries.append(int(reservation.start_slot))
		for slot in boundaries:
			var used = 0
			for reservation in data.capacity_reservations.values():
				if (
					reservation.status == "active"
					and reservation.resource_id == resource_id
					and int(reservation.start_slot) <= slot
					and slot < int(reservation.end_slot)
				):
					used += int(reservation.units)
			if used > int(resource.capacity_units):
				return "Campaign capacity reservations allocate one resource more than once."
	return ""


static func _validated(data: Dictionary, status: String, current: Dictionary) -> Dictionary:
	_seal(data)
	var error = validate(data)
	return {
		"ok": error.is_empty(),
		"status": status if error.is_empty() else "rejected",
		"error": error,
		"operations": data if error.is_empty() else current.duplicate(true)
	}


static func _reject(
	message: String, current: Dictionary, status: String = "rejected"
) -> Dictionary:
	return {"ok": false, "status": status, "error": message, "operations": current.duplicate(true)}


static func _integrity_error(data: Dictionary) -> String:
	var content = data.duplicate(true)
	content.erase("digest")
	if (
		not CampaignIdentity.valid_hash(data.get("digest"))
		or data.digest != RaceStateValue.fingerprint(content)
	):
		return "Campaign operations integrity check failed."
	return ""


static func _seal(data: Dictionary) -> void:
	data.erase("digest")
	data["digest"] = RaceStateValue.fingerprint(data)
