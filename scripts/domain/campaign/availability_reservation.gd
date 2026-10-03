class_name CampaignAvailabilityReservation
extends RefCounted
## Exclusive dated use of one person. Active reservations cannot overlap.
const KINDS = ["factory_work", "event_duty", "commercial", "travel", "training", "leave"]
const STATUSES = ["active", "cancelled"]


static func build(input: Dictionary, created_slot: int) -> Dictionary:
	var data = {
		"id": input.get("id"),
		"person_id": input.get("person_id"),
		"assignment_id": input.get("assignment_id"),
		"start_slot": input.get("start_slot"),
		"end_slot": input.get("end_slot"),
		"kind": input.get("kind"),
		"location_id": input.get("location_id"),
		"created_slot": created_slot,
		"status": "active",
		"cancellation_slot": -1
	}
	_seal(data)
	return data if validate(data).is_empty() else {}


static func cancel(current: Dictionary, cancellation_slot: int) -> Dictionary:
	var error = validate(current)
	if not error.is_empty():
		return {}
	if current.status != "active" or cancellation_slot > int(current.start_slot):
		return {}
	var data = current.duplicate(true)
	data.status = "cancelled"
	data.cancellation_slot = cancellation_slot
	_seal(data)
	return data if validate(data).is_empty() else {}


static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign availability reservation exceeds serialized-value limits."
	if not data is Dictionary or data.size() != 11:
		return "Campaign availability reservation has an unsupported shape."
	for key in ["id", "person_id", "assignment_id", "location_id"]:
		if not CampaignIdentity.valid(data.get(key)):
			return "Campaign availability reservation has an invalid " + key + "."
	if data.get("kind") not in KINDS or data.get("status") not in STATUSES:
		return "Campaign availability reservation has an invalid kind or status."
	var error = _timing_error(data)
	if not error.is_empty():
		return error
	error = _status_error(data)
	if not error.is_empty():
		return error
	return _integrity_error(data)


static func overlaps(left: Dictionary, right: Dictionary) -> bool:
	return int(left.start_slot) < int(right.end_slot) and int(right.start_slot) < int(left.end_slot)


static func _timing_error(data: Dictionary) -> String:
	if (
		not RaceCheckpoint.integral(data.get("created_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS)
		or not RaceCheckpoint.integral(
			data.get("start_slot"), int(data.created_slot), CampaignClock.MAX_ELAPSED_SLOTS
		)
		or not RaceCheckpoint.integral(
			data.get("end_slot"), int(data.start_slot) + 1, CampaignClock.MAX_ELAPSED_SLOTS
		)
	):
		return "Campaign availability reservation has invalid timing."
	if not RaceCheckpoint.integral(
		data.get("cancellation_slot"), -1, CampaignClock.MAX_ELAPSED_SLOTS
	):
		return "Campaign availability reservation has invalid cancellation timing."
	return ""


static func _status_error(data: Dictionary) -> String:
	if data.status == "active" and int(data.cancellation_slot) != -1:
		return "Active campaign availability reservation has cancellation evidence."
	if (
		data.status == "cancelled"
		and (
			int(data.cancellation_slot) < int(data.created_slot)
			or int(data.cancellation_slot) > int(data.start_slot)
		)
	):
		return "Cancelled campaign availability reservation has invalid evidence."
	return ""


static func _integrity_error(data: Dictionary) -> String:
	var content = data.duplicate(true)
	content.erase("digest")
	if (
		not CampaignIdentity.valid_hash(data.get("digest"))
		or data.digest != RaceStateValue.fingerprint(content)
	):
		return "Campaign availability reservation integrity check failed."
	return ""


static func _seal(data: Dictionary) -> void:
	data.erase("digest")
	data["digest"] = RaceStateValue.fingerprint(data)
