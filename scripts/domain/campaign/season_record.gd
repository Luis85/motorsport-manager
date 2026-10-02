class_name CampaignSeasonRecord
extends RefCounted
## Versioned lifecycle coordinating calendar, entries and derived standings.
const KIND = "motorsport-manager-campaign-season"
const VERSION = 1
const STATUSES = [
	"planning", "entries_open", "preseason", "active",
	"final_classification", "settled", "contract_transition", "completed"
]

static func build(definition: Dictionary, rules: Dictionary) -> Dictionary:
	if not CampaignSeriesRules.validate(rules).is_empty():
		return {}
	var calendar_result = CampaignSeasonCalendar.build(definition.get("calendar", []))
	if not calendar_result.ok:
		return {}
	var data = {
		"kind": KIND,
		"version": VERSION,
		"season_id": definition.get("season_id"),
		"series_id": rules.series_id,
		"rules_digest": rules.digest,
		"status": "planning",
		"calendar": calendar_result.calendar,
		"entries": {},
		"drivers": {},
		"teams": {},
		"rankings": {"drivers": [], "teams": []}
	}
	_seal(data)
	return data if validate(data, rules, {}).is_empty() else {}

static func transition(current: Dictionary, target: String, rules: Dictionary, events: Dictionary) -> Dictionary:
	var error = validate(current, rules, events)
	if not error.is_empty():
		return _reject(error, current)
	var allowed = {
		"planning": "entries_open", "entries_open": "preseason", "preseason": "active",
		"active": "final_classification", "final_classification": "settled",
		"settled": "contract_transition", "contract_transition": "completed"
	}
	if allowed.get(current.status, "") != target:
		return _reject("Campaign season lifecycle transition is not permitted.", current)
	if target in ["preseason", "active"]:
		error = CampaignSeasonEntries.gate_error(current.entries, rules)
		if not error.is_empty():
			return _reject(error, current)
	if target == "final_classification":
		error = CampaignSeasonCalendar.finalization_error(current.calendar)
		if not error.is_empty():
			return _reject(error, current)
	var candidate = current.duplicate(true)
	candidate.status = target
	return _validated(candidate, "transitioned", current, rules, events)

static func submit_entry(current: Dictionary, entry: Dictionary, rules: Dictionary, events: Dictionary) -> Dictionary:
	var error = validate(current, rules, events)
	if not error.is_empty():
		return _reject(error, current)
	if current.status != "entries_open":
		return _reject("Campaign entries may be submitted only while entries are open.", current)
	return _publish_entries(current, CampaignSeasonEntries.submit(current.entries, entry, rules), rules, events)

static func decide_entry(current: Dictionary, entrant_id: String, accept: bool,
		rules: Dictionary, events: Dictionary) -> Dictionary:
	var error = validate(current, rules, events)
	if not error.is_empty():
		return _reject(error, current)
	if current.status != "entries_open":
		return _reject("Campaign entry decisions require the open entry window.", current)
	return _publish_entries(current, CampaignSeasonEntries.decide(current.entries, entrant_id, accept), rules, events)

static func withdraw_entry(current: Dictionary, entrant_id: String, rules: Dictionary, events: Dictionary) -> Dictionary:
	var error = validate(current, rules, events)
	if not error.is_empty():
		return _reject(error, current)
	if current.status != "entries_open":
		return _reject("Campaign entry can be withdrawn only before entries close.", current)
	return _publish_entries(current, CampaignSeasonEntries.withdraw(current.entries, entrant_id), rules, events)

static func cancel_next_event(current: Dictionary, event_id: String, reason: String,
		rules: Dictionary, events: Dictionary) -> Dictionary:
	var error = validate(current, rules, events)
	if not error.is_empty():
		return _reject(error, current)
	if current.status != "active":
		return _reject("Only an active season can cancel a scheduled event.", current)
	var changed = CampaignSeasonCalendar.cancel(current.calendar, event_id, reason)
	if not changed.ok:
		return _reject(changed.error, current)
	var candidate = current.duplicate(true)
	candidate.calendar = changed.calendar
	return _validated(candidate, "cancelled", current, rules, events)

static func manifest_error(current: Dictionary, manifest: Dictionary, rules: Dictionary, events: Dictionary) -> String:
	var error = validate(current, rules, events)
	if not error.is_empty():
		return error
	if current.status != "active":
		return "Campaign weekend requires an active season."
	if manifest.get("season_id") != current.season_id:
		return "Campaign weekend belongs to another season."
	error = CampaignSeasonCalendar.manifest_error(current.calendar, manifest)
	if not error.is_empty():
		return error
	return CampaignSeasonEntries.field_mapping_error(current.entries,
		manifest.get("entrant_id"), manifest.get("mappings"))

static func result_error(current: Dictionary, receipt: Dictionary, policy: Dictionary,
		rules: Dictionary, events: Dictionary) -> String:
	var error = validate(current, rules, events)
	if not error.is_empty():
		return error
	if current.status != "active":
		return "Campaign result requires an active season."
	if receipt.get("season_id") != current.season_id \
			or receipt.get("campaign_event_id") != next_scheduled_event_id(current):
		return "Campaign result is not for the next scheduled season event."
	if RaceStateValue.fingerprint(policy.get("points_by_position")) \
			!= RaceStateValue.fingerprint(rules.points_by_position):
		return "Campaign event policy does not use the season's frozen scoring table."
	error = CampaignSeasonEntries.field_mapping_error(current.entries,
		receipt.get("entrant_id"), receipt.get("classification"))
	if not error.is_empty():
		return error
	var expected = CampaignSeasonEntries.accepted_people(current.entries)
	for person_id in policy.eligible_people:
		if not expected.has(person_id):
			return "Campaign points eligibility references a person outside accepted season entries."
	var account_entry = current.entries.get(receipt.entrant_id, {})
	for person_id in policy.account_people:
		if person_id not in account_entry.get("person_ids", []):
			return "Campaign financial participant does not belong to the settled entrant."
	return ""

static func apply_event(current: Dictionary, event_id: String, event: Dictionary,
		rules: Dictionary, events: Dictionary) -> Dictionary:
	var changed = CampaignSeasonCalendar.complete(current.calendar, event_id, event.result_digest)
	if not changed.ok:
		return _reject(changed.error, current)
	var candidate = current.duplicate(true)
	candidate.calendar = changed.calendar
	candidate = rebuild(candidate, events, rules)
	return _validated(candidate, "applied", current, rules, events)

static func next_scheduled_event_id(data: Dictionary) -> String:
	return CampaignSeasonCalendar.next_event_id(data.get("calendar", []))

static func calendar_event(data: Dictionary, event_id: String) -> Dictionary:
	return CampaignSeasonCalendar.event(data.get("calendar", []), event_id)

static func rebuild(current: Dictionary, events: Dictionary, rules: Dictionary) -> Dictionary:
	var candidate = current.duplicate(true)
	var standings = CampaignStandings.build(current.season_id, events, rules)
	candidate.drivers = standings.drivers
	candidate.teams = standings.teams
	candidate.rankings = standings.rankings
	return candidate

static func validate(data: Variant, rules: Dictionary, events: Dictionary) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign season exceeds serialized-value limits."
	if not data is Dictionary or data.size() != 12 or data.get("kind") != KIND:
		return "Unsupported campaign season."
	if not RaceCheckpoint.integral(data.get("version"), VERSION, VERSION) \
			or not CampaignIdentity.valid(data.get("season_id")):
		return "Campaign season version or identity is invalid."
	var error = CampaignSeriesRules.validate(rules)
	if not error.is_empty():
		return error
	if data.get("series_id") != rules.series_id or data.get("rules_digest") != rules.digest:
		return "Campaign season disagrees with its frozen series rules."
	if data.get("status") not in STATUSES:
		return "Campaign season has an invalid lifecycle state."
	error = CampaignSeasonCalendar.validate(data.get("calendar"), rules, data.status)
	if not error.is_empty():
		return error
	error = CampaignSeasonEntries.validate(data.get("entries"), rules)
	if not error.is_empty():
		return error
	if data.status not in ["planning", "entries_open"]:
		error = CampaignSeasonEntries.gate_error(data.entries, rules)
		if not error.is_empty():
			return error
	error = CampaignStandings.shape_error(data)
	if not error.is_empty():
		return error
	error = _event_link_error(data, events)
	if not error.is_empty():
		return error
	error = CampaignStandings.projection_error(data,
		CampaignStandings.build(data.season_id, events, rules))
	if not error.is_empty():
		return error
	var content = data.duplicate(true)
	content.erase("digest")
	if not CampaignIdentity.valid_hash(data.get("digest")) or data.digest != RaceStateValue.fingerprint(content):
		return "Campaign season integrity check failed."
	return ""

static func _event_link_error(data: Dictionary, events: Dictionary) -> String:
	var calendar = {}
	for item in data.calendar:
		calendar[item.campaign_event_id] = item
	for event_id in events:
		var event = events[event_id]
		if not event is Dictionary or event.get("season_id") != data.season_id:
			continue
		if not calendar.has(event_id) or calendar[event_id].status != "completed" \
				or calendar[event_id].resolution_ref != event.get("result_digest"):
			return "Campaign event history disagrees with the season calendar."
		var mapping_error = CampaignSeasonEntries.awards_mapping_error(data.entries, event.get("awards"))
		if not mapping_error.is_empty():
			return mapping_error
	for event_id in calendar:
		var item = calendar[event_id]
		if item.status == "completed" and (not events.has(event_id) \
				or events[event_id].get("season_id") != data.season_id):
			return "Completed campaign calendar event has no sporting record."
		if item.status != "completed" and events.has(event_id) \
				and events[event_id].get("season_id") == data.season_id:
			return "Unresolved campaign calendar event already has a sporting record."
	return ""

static func _publish_entries(current: Dictionary, changed: Dictionary,
		rules: Dictionary, events: Dictionary) -> Dictionary:
	if not changed.ok:
		return _reject(changed.error, current)
	var candidate = current.duplicate(true)
	candidate.entries = changed.entries
	return _validated(candidate, changed.status, current, rules, events)

static func _validated(candidate: Dictionary, status: String, current: Dictionary,
		rules: Dictionary, events: Dictionary) -> Dictionary:
	_seal(candidate)
	var error = validate(candidate, rules, events)
	return {"ok": error.is_empty(), "status": status if error.is_empty() else "rejected",
		"error": error, "season": candidate if error.is_empty() else current.duplicate(true)}

static func _seal(data: Dictionary) -> void:
	data.erase("digest")
	data["digest"] = RaceStateValue.fingerprint(data)

static func _reject(message: String, current: Dictionary) -> Dictionary:
	return {"ok": false, "status": "rejected", "error": message, "season": current.duplicate(true)}
