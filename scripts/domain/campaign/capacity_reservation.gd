class_name CampaignCapacityReservation
extends RefCounted
## Exclusive bounded units of one facility or rented-service resource.
const STATUSES = ["active", "cancelled"]

static func build(input: Dictionary, created_slot: int) -> Dictionary:
	var data = {
		"id": input.get("id"),
		"work_order_id": input.get("work_order_id"),
		"resource_id": input.get("resource_id"),
		"created_slot": created_slot,
		"start_slot": input.get("start_slot"),
		"end_slot": input.get("end_slot"),
		"units": input.get("units"),
		"status": "active",
		"cancellation_slot": -1
	}
	_seal(data)
	return data if validate(data).is_empty() else {}

static func cancel(current: Dictionary, cancellation_slot: int) -> Dictionary:
	if not validate(current).is_empty() or current.status != "active" \
			or cancellation_slot < int(current.created_slot) or cancellation_slot > int(current.start_slot):
		return {}
	var data = current.duplicate(true)
	data.status = "cancelled"
	data.cancellation_slot = cancellation_slot
	_seal(data)
	return data if validate(data).is_empty() else {}

static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign capacity reservation exceeds serialized-value limits."
	if not data is Dictionary or data.size() != 10:
		return "Campaign capacity reservation has an unsupported shape."
	for key in ["id", "work_order_id", "resource_id"]:
		if not CampaignIdentity.valid(data.get(key)):
			return "Campaign capacity reservation has an invalid " + key + "."
	if not RaceCheckpoint.integral(data.get("created_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS) \
			or not RaceCheckpoint.integral(data.get("start_slot"), int(data.created_slot), CampaignClock.MAX_ELAPSED_SLOTS) \
			or not RaceCheckpoint.integral(data.get("end_slot"), int(data.start_slot) + 1, CampaignClock.MAX_ELAPSED_SLOTS) \
			or not RaceCheckpoint.integral(data.get("units"), 1, CampaignCapacityResource.MAX_UNITS):
		return "Campaign capacity reservation has invalid timing or units."
	if data.get("status") not in STATUSES \
			or not RaceCheckpoint.integral(data.get("cancellation_slot"), -1, CampaignClock.MAX_ELAPSED_SLOTS):
		return "Campaign capacity reservation has invalid status evidence."
	if data.status == "active" and int(data.cancellation_slot) != -1:
		return "Active campaign capacity reservation already has cancellation evidence."
	if data.status == "cancelled" and (int(data.cancellation_slot) < int(data.created_slot) \
			or int(data.cancellation_slot) > int(data.start_slot)):
		return "Cancelled campaign capacity reservation has invalid evidence."
	return _integrity_error(data)

static func overlaps(left: Dictionary, right: Dictionary) -> bool:
	return int(left.start_slot) < int(right.end_slot) and int(right.start_slot) < int(left.end_slot)

static func _integrity_error(data: Dictionary) -> String:
	var content = data.duplicate(true)
	content.erase("digest")
	if not CampaignIdentity.valid_hash(data.get("digest")) \
			or data.digest != RaceStateValue.fingerprint(content):
		return "Campaign capacity reservation integrity check failed."
	return ""

static func _seal(data: Dictionary) -> void:
	data.erase("digest")
	data["digest"] = RaceStateValue.fingerprint(data)
