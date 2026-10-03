class_name CampaignWorkOrder
extends RefCounted
## One scheduled use of internal capacity or one external rented service.
const MODES = ["internal", "rented_service"]
const STATUSES = ["scheduled", "cancelled"]
const MAX_ASSIGNMENTS = 16


static func build(input: Dictionary, created_slot: int) -> Dictionary:
	var data = {
		"id": input.get("id"),
		"mode": input.get("mode"),
		"family": input.get("family"),
		"resource_id": input.get("resource_id"),
		"created_slot": created_slot,
		"start_slot": input.get("start_slot"),
		"end_slot": input.get("end_slot"),
		"units": input.get("units"),
		"assignment_ids": input.get("assignment_ids", []).duplicate(true),
		"personnel_reservation_ids": input.get("personnel_reservation_ids", []).duplicate(true),
		"capacity_reservation_id": input.get("capacity_reservation_id"),
		"commitment_ids": input.get("commitment_ids", []).duplicate(true),
		"quoted_cost_minor": input.get("quoted_cost_minor", 0),
		"status": "scheduled",
		"cancellation_slot": -1
	}
	_seal(data)
	return data if validate(data).is_empty() else {}


static func cancel(current: Dictionary, slot: int) -> Dictionary:
	if (
		not validate(current).is_empty()
		or current.status != "scheduled"
		or slot < int(current.created_slot)
		or slot > int(current.start_slot)
	):
		return {}
	var data = current.duplicate(true)
	data.status = "cancelled"
	data.cancellation_slot = slot
	_seal(data)
	return data if validate(data).is_empty() else {}


static func state_at(data: Dictionary, slot: int) -> String:
	if not validate(data).is_empty() or slot < int(data.created_slot):
		return "unknown"
	if data.status == "cancelled":
		return "cancelled"
	if slot < int(data.start_slot):
		return "planned"
	if slot < int(data.end_slot):
		return "active"
	return "complete"


static func personnel_reservation_id(order_id: String, assignment_id: String) -> String:
	return "workperson." + RaceStateValue.fingerprint([order_id, assignment_id]).substr(0, 24)


static func capacity_reservation_id(order_id: String) -> String:
	return "workcapacity." + RaceStateValue.fingerprint(order_id).substr(0, 24)


static func commitment_id(order_id: String) -> String:
	return "facility." + RaceStateValue.fingerprint(order_id).substr(0, 24)


static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign work order exceeds serialized-value limits."
	if not data is Dictionary or data.size() != 16:
		return "Campaign work order has an unsupported shape."
	for key in ["id", "resource_id", "capacity_reservation_id"]:
		if not CampaignIdentity.valid(data.get(key)):
			return "Campaign work order has an invalid " + key + "."
	if data.get("mode") not in MODES or data.get("family") not in CampaignCapacityResource.FAMILIES:
		return "Campaign work order has an unsupported mode or facility family."
	if data.capacity_reservation_id != capacity_reservation_id(data.id):
		return "Campaign work order has a non-deterministic capacity reservation identity."
	if (
		not RaceCheckpoint.integral(data.get("created_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS)
		or not RaceCheckpoint.integral(
			data.get("start_slot"), int(data.created_slot), CampaignClock.MAX_ELAPSED_SLOTS
		)
		or not RaceCheckpoint.integral(
			data.get("end_slot"), int(data.start_slot) + 1, CampaignClock.MAX_ELAPSED_SLOTS
		)
		or not RaceCheckpoint.integral(data.get("units"), 1, CampaignCapacityResource.MAX_UNITS)
	):
		return "Campaign work order has invalid timing or units."
	if (
		not RaceCheckpoint.integral(data.get("quoted_cost_minor"), 0, CampaignEconomy.MAX_MINOR)
		or data.get("status") not in STATUSES
		or not RaceCheckpoint.integral(
			data.get("cancellation_slot"), -1, CampaignClock.MAX_ELAPSED_SLOTS
		)
	):
		return "Campaign work order has invalid financial or lifecycle evidence."
	var list_error = _lists_error(data)
	if not list_error.is_empty():
		return list_error
	if data.status == "scheduled" and int(data.cancellation_slot) != -1:
		return "Scheduled campaign work order already has cancellation evidence."
	if (
		data.status == "cancelled"
		and (
			int(data.cancellation_slot) < int(data.created_slot)
			or int(data.cancellation_slot) > int(data.start_slot)
		)
	):
		return "Cancelled campaign work order has invalid evidence."
	return _integrity_error(data)


static func _lists_error(data: Dictionary) -> String:
	for key in ["assignment_ids", "personnel_reservation_ids", "commitment_ids"]:
		if not data.get(key) is Array:
			return "Campaign work order has an invalid " + key + "."
		var seen = {}
		for value in data[key]:
			if not CampaignIdentity.valid(value) or seen.has(value):
				return "Campaign work order has a duplicated or invalid linked identity."
			seen[value] = true
	if (
		data.assignment_ids.size() > MAX_ASSIGNMENTS
		or data.personnel_reservation_ids.size() != data.assignment_ids.size()
	):
		return "Campaign work order has an invalid personnel reservation set."
	if (
		data.mode == "internal"
		and (
			data.assignment_ids.is_empty()
			or not data.commitment_ids.is_empty()
			or int(data.quoted_cost_minor) != 0
		)
	):
		return "Internal campaign work requires staff and cannot hide a rented-service charge."
	if (
		data.mode == "rented_service"
		and (
			not data.assignment_ids.is_empty()
			or data.commitment_ids.size() != 1
			or int(data.quoted_cost_minor) <= 0
		)
	):
		return "Rented campaign work requires one explicit service commitment and no internal staff reservation."
	if data.mode == "rented_service" and data.commitment_ids[0] != commitment_id(data.id):
		return "Campaign rented-service commitment identity is not deterministic."
	return ""


static func _integrity_error(data: Dictionary) -> String:
	var content = data.duplicate(true)
	content.erase("digest")
	if (
		not CampaignIdentity.valid_hash(data.get("digest"))
		or data.digest != RaceStateValue.fingerprint(content)
	):
		return "Campaign work order integrity check failed."
	return ""


static func _seal(data: Dictionary) -> void:
	data.erase("digest")
	data["digest"] = RaceStateValue.fingerprint(data)
