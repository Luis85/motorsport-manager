class_name CampaignSeasonCalendar
extends RefCounted
## Ordered immutable schedule with prefix-only completion/cancellation state.
const MAX_REASON_LENGTH = 240
const EVENT_STATUSES = ["scheduled", "completed", "cancelled"]


static func build(source: Variant) -> Dictionary:
	if not source is Array:
		return {"ok": false, "error": "Campaign season calendar must be an array.", "calendar": []}
	var calendar: Array = []
	for item in source:
		if not item is Dictionary:
			return {
				"ok": false,
				"error": "Campaign season calendar event must be a record.",
				"calendar": []
			}
		calendar.append(
			{
				"campaign_event_id": item.get("campaign_event_id"),
				"round": item.get("round"),
				"departure_slot": item.get("departure_slot"),
				"return_slot": item.get("return_slot"),
				"event_revision": item.get("event_revision", 1),
				"track_hash": item.get("track_hash"),
				"ruleset_hash": item.get("ruleset_hash"),
				"status": "scheduled",
				"resolution_ref": ""
			}
		)
	return {"ok": true, "error": "", "calendar": calendar}


static func validate(value: Variant, rules: Dictionary, season_status: String) -> String:
	if (
		not value is Array
		or value.size() < int(rules.min_events)
		or value.size() > int(rules.max_events)
	):
		return "Campaign season calendar has an invalid event count."
	var seen = {}
	var previous_return = -1
	var found_scheduled = false
	for index in range(value.size()):
		var item = value[index]
		if not item is Dictionary or item.size() != 9:
			return "Campaign season calendar event has an unsupported shape."
		if (
			not CampaignIdentity.valid(item.get("campaign_event_id"))
			or seen.has(item.campaign_event_id)
		):
			return "Campaign season calendar has an invalid or repeated event identity."
		seen[item.campaign_event_id] = true
		var event_error = _event_error(item, index, previous_return)
		if not event_error.is_empty():
			return event_error
		previous_return = int(item.return_slot)
		if item.get("status") not in EVENT_STATUSES:
			return "Campaign season calendar event has an invalid status."
		if item.status == "scheduled":
			found_scheduled = true
			if item.get("resolution_ref") != "":
				return "Scheduled campaign event already has a resolution."
		elif found_scheduled:
			return "Campaign season calendar resolutions are out of order."
		elif item.status == "completed":
			if not CampaignIdentity.valid_hash(item.get("resolution_ref")):
				return "Completed campaign event has an invalid result reference."
		elif (
			not item.get("resolution_ref") is String
			or item.resolution_ref.is_empty()
			or item.resolution_ref.length() > MAX_REASON_LENGTH
		):
			return "Cancelled campaign event has an invalid reason."
	var lifecycle_error = _lifecycle_error(value, season_status)
	if not lifecycle_error.is_empty():
		return lifecycle_error
	return ""


static func next_event_id(calendar: Array) -> String:
	for item in calendar:
		if item.status == "scheduled":
			return item.campaign_event_id
	return ""


static func event(calendar: Array, event_id: String) -> Dictionary:
	for item in calendar:
		if item.campaign_event_id == event_id:
			return item
	return {}


static func complete(calendar: Array, event_id: String, result_digest: String) -> Dictionary:
	if not CampaignIdentity.valid_hash(result_digest):
		return {
			"ok": false,
			"error": "Campaign event has an invalid result digest.",
			"calendar": calendar.duplicate(true)
		}
	var candidate = calendar.duplicate(true)
	for index in range(candidate.size()):
		if candidate[index].campaign_event_id == event_id:
			if candidate[index].status != "scheduled":
				return {
					"ok": false,
					"error": "Campaign event is already resolved.",
					"calendar": calendar.duplicate(true)
				}
			candidate[index].status = "completed"
			candidate[index].resolution_ref = result_digest
			return {"ok": true, "error": "", "calendar": candidate}
	return {
		"ok": false,
		"error": "Campaign event is absent from the season calendar.",
		"calendar": calendar.duplicate(true)
	}


static func cancel(calendar: Array, event_id: String, reason: String) -> Dictionary:
	if event_id != next_event_id(calendar):
		return {
			"ok": false,
			"error": "Only the next scheduled event can be cancelled.",
			"calendar": calendar.duplicate(true)
		}
	if reason.is_empty() or reason.length() > MAX_REASON_LENGTH:
		return {
			"ok": false,
			"error": "Campaign event cancellation requires a bounded reason.",
			"calendar": calendar.duplicate(true)
		}
	var candidate = calendar.duplicate(true)
	for index in range(candidate.size()):
		if candidate[index].campaign_event_id == event_id:
			candidate[index].status = "cancelled"
			candidate[index].resolution_ref = reason
			return {"ok": true, "error": "", "calendar": candidate}
	return {
		"ok": false,
		"error": "Campaign event is absent from the season calendar.",
		"calendar": calendar.duplicate(true)
	}


static func finalization_error(calendar: Array) -> String:
	var completed = 0
	for item in calendar:
		if item.status == "scheduled":
			return "Campaign season cannot finalize while calendar events remain scheduled."
		if item.status == "completed":
			completed += 1
	return (
		""
		if completed > 0
		else "Campaign season requires at least one completed event before final classification."
	)


static func manifest_error(calendar: Array, manifest: Dictionary) -> String:
	var event_id = next_event_id(calendar)
	if event_id.is_empty() or manifest.get("campaign_event_id") != event_id:
		return "Campaign weekend is not the next scheduled season event."
	var scheduled: Dictionary = event(calendar, event_id)
	for binding in [
		["departure_slot", scheduled.departure_slot],
		["return_slot", scheduled.return_slot],
		["event_revision", scheduled.event_revision],
		["track_hash", scheduled.track_hash],
		["ruleset_hash", scheduled.ruleset_hash]
	]:
		if manifest.get(binding[0]) != binding[1]:
			return "Campaign weekend differs from its frozen season calendar."
	return ""


static func _event_error(item: Dictionary, index: int, previous_return: int) -> String:
	if not RaceCheckpoint.integral(item.get("round"), index + 1, index + 1):
		return "Campaign season calendar rounds are not ordered."
	if (
		not RaceCheckpoint.integral(item.get("departure_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS)
		or not RaceCheckpoint.integral(
			item.get("return_slot"), int(item.departure_slot) + 1, CampaignClock.MAX_ELAPSED_SLOTS
		)
	):
		return "Campaign season calendar has invalid event slots."
	if int(item.departure_slot) < previous_return:
		return "Campaign season calendar events overlap or are out of order."
	if (
		not RaceCheckpoint.integral(item.get("event_revision"), 1, 1000000)
		or not CampaignIdentity.valid_hash(item.get("track_hash"))
		or not CampaignIdentity.valid_hash(item.get("ruleset_hash"))
	):
		return "Campaign season calendar has invalid frozen event evidence."
	return ""


static func _lifecycle_error(value: Array, season_status: String) -> String:
	if season_status in ["planning", "entries_open", "preseason"]:
		for item in value:
			if item.status != "scheduled":
				return "Campaign events cannot resolve before the championship is active."
	if season_status in ["final_classification", "settled", "contract_transition", "completed"]:
		for item in value:
			if item.status == "scheduled":
				return "Completed campaign season lifecycle still has scheduled events."
	return ""
