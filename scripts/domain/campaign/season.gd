class_name CampaignSeason
extends RefCounted
## Versioned calendar, entry registry, lifecycle and derived standings for one season.
const KIND = "motorsport-manager-campaign-season"
const VERSION = 1
const MAX_REASON_LENGTH = 240
const STATUSES = [
	"planning", "entries_open", "preseason", "active",
	"final_classification", "settled", "contract_transition", "completed"
]
const ENTRY_STATUSES = ["submitted", "accepted", "rejected", "withdrawn"]
const EVENT_STATUSES = ["scheduled", "completed", "cancelled"]

static func build(definition: Dictionary, rules: Dictionary) -> Dictionary:
	if not CampaignSeriesRules.validate(rules).is_empty():
		return {}
	var source = definition.get("calendar", [])
	if not source is Array:
		return {}
	var calendar: Array = []
	for item in source:
		if not item is Dictionary:
			return {}
		calendar.append({
			"campaign_event_id": item.get("campaign_event_id"),
			"round": item.get("round"),
			"departure_slot": item.get("departure_slot"),
			"return_slot": item.get("return_slot"),
			"event_revision": item.get("event_revision", 1),
			"track_hash": item.get("track_hash"),
			"ruleset_hash": item.get("ruleset_hash"),
			"status": "scheduled",
			"resolution_ref": ""
		})
	var data = {
		"kind": KIND,
		"version": VERSION,
		"season_id": definition.get("season_id"),
		"series_id": rules.series_id,
		"rules_digest": rules.digest,
		"status": "planning",
		"calendar": calendar,
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
		"planning": "entries_open",
		"entries_open": "preseason",
		"preseason": "active",
		"active": "final_classification",
		"final_classification": "settled",
		"settled": "contract_transition",
		"contract_transition": "completed"
	}
	if allowed.get(current.status, "") != target:
		return _reject("Campaign season lifecycle transition is not permitted.", current)
	if target in ["preseason", "active"]:
		error = _entry_gate_error(current, rules)
		if not error.is_empty():
			return _reject(error, current)
	if target == "final_classification":
		var completed = 0
		for item in current.calendar:
			if item.status == "scheduled":
				return _reject("Campaign season cannot finalize while calendar events remain scheduled.", current)
			if item.status == "completed":
				completed += 1
		if completed == 0:
			return _reject("Campaign season requires at least one completed event before final classification.", current)
	var candidate = current.duplicate(true)
	candidate.status = target
	_seal(candidate)
	error = validate(candidate, rules, events)
	return {"ok": error.is_empty(), "status": "transitioned" if error.is_empty() else "rejected",
		"error": error, "season": candidate if error.is_empty() else current.duplicate(true)}

static func submit_entry(current: Dictionary, entry: Dictionary, rules: Dictionary, events: Dictionary) -> Dictionary:
	var error = validate(current, rules, events)
	if not error.is_empty():
		return _reject(error, current)
	if current.status != "entries_open":
		return _reject("Campaign entries may be submitted only while entries are open.", current)
	if current.entries.size() >= int(rules.max_entrants):
		return _reject("Campaign season entry registry is full.", current)
	var entrant_id = entry.get("entrant_id")
	if not CampaignIdentity.valid(entrant_id) or current.entries.has(entrant_id):
		return _reject("Campaign season entry has an invalid or repeated entrant identity.", current)
	var record = {
		"entrant_id": entrant_id,
		"team_id": entry.get("team_id"),
		"person_ids": entry.get("person_ids", []).duplicate(true),
		"car_ids": entry.get("car_ids", []).duplicate(true),
		"status": "submitted"
	}
	error = _entry_error(record, rules)
	if not error.is_empty():
		return _reject(error, current)
	error = _entry_conflict_error(current.entries, record)
	if not error.is_empty():
		return _reject(error, current)
	var candidate = current.duplicate(true)
	candidate.entries[entrant_id] = record
	_seal(candidate)
	error = validate(candidate, rules, events)
	return {"ok": error.is_empty(), "status": "submitted" if error.is_empty() else "rejected",
		"error": error, "season": candidate if error.is_empty() else current.duplicate(true)}

static func decide_entry(current: Dictionary, entrant_id: String, accept: bool,
		rules: Dictionary, events: Dictionary) -> Dictionary:
	var error = validate(current, rules, events)
	if not error.is_empty():
		return _reject(error, current)
	if current.status != "entries_open" or not current.entries.has(entrant_id) \
			or current.entries[entrant_id].status != "submitted":
		return _reject("Campaign entry decision requires one submitted entry while entries are open.", current)
	var candidate = current.duplicate(true)
	candidate.entries[entrant_id].status = "accepted" if accept else "rejected"
	_seal(candidate)
	error = validate(candidate, rules, events)
	return {"ok": error.is_empty(), "status": candidate.entries[entrant_id].status if error.is_empty() else "rejected",
		"error": error, "season": candidate if error.is_empty() else current.duplicate(true)}

static func withdraw_entry(current: Dictionary, entrant_id: String, rules: Dictionary, events: Dictionary) -> Dictionary:
	var error = validate(current, rules, events)
	if not error.is_empty():
		return _reject(error, current)
	if current.status != "entries_open" or not current.entries.has(entrant_id) \
			or current.entries[entrant_id].status not in ["submitted", "accepted"]:
		return _reject("Campaign entry can be withdrawn only before entries close.", current)
	var candidate = current.duplicate(true)
	candidate.entries[entrant_id].status = "withdrawn"
	_seal(candidate)
	error = validate(candidate, rules, events)
	return {"ok": error.is_empty(), "status": "withdrawn" if error.is_empty() else "rejected",
		"error": error, "season": candidate if error.is_empty() else current.duplicate(true)}

static func cancel_next_event(current: Dictionary, event_id: String, reason: String,
		rules: Dictionary, events: Dictionary) -> Dictionary:
	var error = validate(current, rules, events)
	if not error.is_empty():
		return _reject(error, current)
	if current.status != "active" or event_id != next_scheduled_event_id(current):
		return _reject("Only the next scheduled event can be cancelled in an active season.", current)
	if reason.is_empty() or reason.length() > MAX_REASON_LENGTH:
		return _reject("Campaign event cancellation requires a bounded reason.", current)
	var candidate = current.duplicate(true)
	for index in range(candidate.calendar.size()):
		if candidate.calendar[index].campaign_event_id == event_id:
			candidate.calendar[index].status = "cancelled"
			candidate.calendar[index].resolution_ref = reason
			break
	_seal(candidate)
	error = validate(candidate, rules, events)
	return {"ok": error.is_empty(), "status": "cancelled" if error.is_empty() else "rejected",
		"error": error, "season": candidate if error.is_empty() else current.duplicate(true)}

static func manifest_error(current: Dictionary, manifest: Dictionary, rules: Dictionary, events: Dictionary) -> String:
	var error = validate(current, rules, events)
	if not error.is_empty():
		return error
	if current.status != "active":
		return "Campaign weekend requires an active season."
	if manifest.get("season_id") != current.season_id:
		return "Campaign weekend belongs to another season."
	var event_id = next_scheduled_event_id(current)
	if event_id.is_empty() or manifest.get("campaign_event_id") != event_id:
		return "Campaign weekend is not the next scheduled season event."
	var scheduled: Dictionary = calendar_event(current, event_id)
	for binding in [
		["departure_slot", scheduled.departure_slot],
		["return_slot", scheduled.return_slot],
		["event_revision", scheduled.event_revision],
		["track_hash", scheduled.track_hash],
		["ruleset_hash", scheduled.ruleset_hash]
	]:
		if manifest.get(binding[0]) != binding[1]:
			return "Campaign weekend differs from its frozen season calendar."
	return _field_mapping_error(current, manifest.get("entrant_id"), manifest.get("mappings"))

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
	if RaceStateValue.fingerprint(policy.get("points_by_position")) != RaceStateValue.fingerprint(rules.points_by_position):
		return "Campaign event policy does not use the season's frozen scoring table."
	error = _field_mapping_error(current, receipt.get("entrant_id"), receipt.get("classification"))
	if not error.is_empty():
		return error
	var expected = _accepted_people(current)
	for person_id in policy.eligible_people:
		if not expected.has(person_id):
			return "Campaign points eligibility references a person outside accepted season entries."
	var account_entry = current.entries.get(receipt.entrant_id, {})
	for person_id in policy.account_people:
		if not person_id in account_entry.get("person_ids", []):
			return "Campaign financial participant does not belong to the settled entrant."
	return ""

static func apply_event(current: Dictionary, event_id: String, event: Dictionary,
		rules: Dictionary, events: Dictionary) -> Dictionary:
	var candidate = current.duplicate(true)
	var found = false
	for index in range(candidate.calendar.size()):
		if candidate.calendar[index].campaign_event_id == event_id:
			candidate.calendar[index].status = "completed"
			candidate.calendar[index].resolution_ref = event.result_digest
			found = true
			break
	if not found:
		return _reject("Campaign event is absent from the season calendar.", current)
	candidate = rebuild(candidate, events, rules)
	_seal(candidate)
	var error = validate(candidate, rules, events)
	return {"ok": error.is_empty(), "status": "applied" if error.is_empty() else "rejected",
		"error": error, "season": candidate if error.is_empty() else current.duplicate(true)}

static func next_scheduled_event_id(data: Dictionary) -> String:
	for item in data.get("calendar", []):
		if item.status == "scheduled":
			return item.campaign_event_id
	return ""

static func calendar_event(data: Dictionary, event_id: String) -> Dictionary:
	for item in data.get("calendar", []):
		if item.campaign_event_id == event_id:
			return item
	return {}

static func rebuild(current: Dictionary, events: Dictionary, rules: Dictionary) -> Dictionary:
	var candidate = current.duplicate(true)
	candidate.drivers = {}
	candidate.teams = {}
	var event_ids = events.keys()
	event_ids.sort()
	for event_id in event_ids:
		var event = events[event_id]
		if not event is Dictionary or event.get("season_id") != current.season_id:
			continue
		for award in event.get("awards", []):
			_accumulate(candidate.drivers, award.person_id, award, rules)
			_accumulate(candidate.teams, award.team_id, award, rules)
	candidate.rankings = {
		"drivers": _rank(candidate.drivers, int(rules.countback_depth)),
		"teams": _rank(candidate.teams, int(rules.countback_depth))
	}
	return candidate

static func validate(data: Variant, rules: Dictionary, events: Dictionary) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign season exceeds serialized-value limits."
	if not data is Dictionary or data.size() != 12 or data.get("kind") != KIND:
		return "Unsupported campaign season."
	if not RaceCheckpoint.integral(data.get("version"), VERSION, VERSION) \
			or not CampaignIdentity.valid(data.get("season_id")):
		return "Campaign season version or identity is invalid."
	var rules_error = CampaignSeriesRules.validate(rules)
	if not rules_error.is_empty():
		return rules_error
	if data.get("series_id") != rules.series_id or data.get("rules_digest") != rules.digest:
		return "Campaign season disagrees with its frozen series rules."
	if data.get("status") not in STATUSES:
		return "Campaign season has an invalid lifecycle state."
	var calendar_error = _calendar_error(data.get("calendar"), rules, data.status)
	if not calendar_error.is_empty():
		return calendar_error
	var entries_error = _entries_error(data.get("entries"), rules)
	if not entries_error.is_empty():
		return entries_error
	if data.status not in ["planning", "entries_open"]:
		var gate_error = _entry_gate_error(data, rules)
		if not gate_error.is_empty():
			return gate_error
	if not data.get("drivers") is Dictionary or not data.get("teams") is Dictionary \
			or not data.get("rankings") is Dictionary or data.rankings.size() != 2 \
			or not data.rankings.get("drivers") is Array or not data.rankings.get("teams") is Array:
		return "Campaign season standings have an unsupported shape."
	var event_error = _event_link_error(data, events)
	if not event_error.is_empty():
		return event_error
	var rebuilt = rebuild(data, events, rules)
	for key in ["drivers", "teams", "rankings"]:
		if RaceStateValue.fingerprint(rebuilt[key]) != RaceStateValue.fingerprint(data[key]):
			return "Campaign season standings disagree with completed event awards."
	var content = data.duplicate(true)
	content.erase("digest")
	if not CampaignIdentity.valid_hash(data.get("digest")) or data.digest != RaceStateValue.fingerprint(content):
		return "Campaign season integrity check failed."
	return ""

static func _calendar_error(value: Variant, rules: Dictionary, season_status: String) -> String:
	if not value is Array or value.size() < int(rules.min_events) or value.size() > int(rules.max_events):
		return "Campaign season calendar has an invalid event count."
	var seen = {}
	var previous_return = -1
	var found_scheduled = false
	for index in range(value.size()):
		var item = value[index]
		if not item is Dictionary or item.size() != 9:
			return "Campaign season calendar event has an unsupported shape."
		if not CampaignIdentity.valid(item.get("campaign_event_id")) or seen.has(item.campaign_event_id):
			return "Campaign season calendar has an invalid or repeated event identity."
		seen[item.campaign_event_id] = true
		if not RaceCheckpoint.integral(item.get("round"), index + 1, index + 1):
			return "Campaign season calendar rounds are not ordered."
		if not RaceCheckpoint.integral(item.get("departure_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS) \
				or not RaceCheckpoint.integral(item.get("return_slot"), int(item.departure_slot) + 1, CampaignClock.MAX_ELAPSED_SLOTS):
			return "Campaign season calendar has invalid event slots."
		if int(item.departure_slot) < previous_return:
			return "Campaign season calendar events overlap or are out of order."
		previous_return = int(item.return_slot)
		if not RaceCheckpoint.integral(item.get("event_revision"), 1, 1000000) \
				or not CampaignIdentity.valid_hash(item.get("track_hash")) \
				or not CampaignIdentity.valid_hash(item.get("ruleset_hash")):
			return "Campaign season calendar has invalid frozen event evidence."
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
		elif not item.get("resolution_ref") is String or item.resolution_ref.is_empty() \
				or item.resolution_ref.length() > MAX_REASON_LENGTH:
			return "Cancelled campaign event has an invalid reason."
	if season_status in ["planning", "entries_open", "preseason"]:
		for item in value:
			if item.status != "scheduled":
				return "Campaign events cannot resolve before the championship is active."
	if season_status in ["final_classification", "settled", "contract_transition", "completed"]:
		for item in value:
			if item.status == "scheduled":
				return "Completed campaign season lifecycle still has scheduled events."
	return ""

static func _entries_error(value: Variant, rules: Dictionary) -> String:
	if not value is Dictionary or value.size() > int(rules.max_entrants):
		return "Campaign season entry registry is invalid."
	var live_people = {}
	var live_cars = {}
	var live_teams = {}
	for entrant_id in value:
		var entry = value[entrant_id]
		if entrant_id != entry.get("entrant_id"):
			return "Campaign entry key disagrees with its identity."
		var error = _entry_error(entry, rules)
		if not error.is_empty():
			return error
		if entry.status in ["submitted", "accepted"]:
			if live_teams.has(entry.team_id):
				return "Campaign live entries repeat a team identity."
			live_teams[entry.team_id] = true
			for person_id in entry.person_ids:
				if live_people.has(person_id):
					return "Campaign live entries repeat a person identity."
				live_people[person_id] = true
			for car_id in entry.car_ids:
				if live_cars.has(car_id):
					return "Campaign live entries repeat a car identity."
				live_cars[car_id] = true
	return ""

static func _entry_error(entry: Variant, rules: Dictionary) -> String:
	if not entry is Dictionary or entry.size() != 5:
		return "Campaign season entry has an unsupported shape."
	for key in ["entrant_id", "team_id"]:
		if not CampaignIdentity.valid(entry.get(key)):
			return "Campaign season entry has an invalid " + key + "."
	if entry.get("status") not in ENTRY_STATUSES:
		return "Campaign season entry has an invalid status."
	for key in ["person_ids", "car_ids"]:
		var values = entry.get(key)
		if not values is Array or values.size() != int(rules.cars_per_entrant):
			return "Campaign season entry has an invalid " + key + " allocation."
		var seen = {}
		for identity in values:
			if not CampaignIdentity.valid(identity) or seen.has(identity):
				return "Campaign season entry has an invalid or repeated " + key + " identity."
			seen[identity] = true
	return ""

static func _entry_conflict_error(entries: Dictionary, candidate: Dictionary) -> String:
	for entry in entries.values():
		if entry.status not in ["submitted", "accepted"]:
			continue
		if entry.team_id == candidate.team_id:
			return "Campaign live entries repeat a team identity."
		for person_id in candidate.person_ids:
			if person_id in entry.person_ids:
				return "Campaign live entries repeat a person identity."
		for car_id in candidate.car_ids:
			if car_id in entry.car_ids:
				return "Campaign live entries repeat a car identity."
	return ""

static func _entry_gate_error(data: Dictionary, rules: Dictionary) -> String:
	var accepted = 0
	for entry in data.entries.values():
		if entry.status == "submitted":
			return "Campaign season cannot close entries while a submission is undecided."
		if entry.status == "accepted":
			accepted += 1
	if accepted < int(rules.min_entrants) or accepted > int(rules.max_entrants):
		return "Campaign season does not have the required accepted entrants."
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
		var mapping_error = _awards_mapping_error(data, event.get("awards"))
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

static func _field_mapping_error(data: Dictionary, entrant_id: Variant, rows: Variant) -> String:
	if not CampaignIdentity.valid(entrant_id) or not data.entries.has(entrant_id) \
			or data.entries[entrant_id].status != "accepted":
		return "Campaign weekend entrant is not accepted for the season."
	if not rows is Array:
		return "Campaign weekend field mapping is invalid."
	var expected = _accepted_people(data)
	if rows.size() != expected.size():
		return "Campaign weekend field does not cover every accepted season car."
	var seen = {}
	for row in rows:
		if not row is Dictionary or not expected.has(row.get("person_id")) or seen.has(row.person_id):
			return "Campaign weekend field has an unknown or repeated season person."
		seen[row.person_id] = true
		var identity: Dictionary = expected[row.person_id]
		if row.get("team_id") != identity.team_id or row.get("car_id") != identity.car_id:
			return "Campaign weekend field differs from accepted season entries."
	return ""

static func _awards_mapping_error(data: Dictionary, awards: Variant) -> String:
	if not awards is Array:
		return "Campaign sporting awards are invalid."
	var rows: Array = []
	for award in awards:
		if not award is Dictionary:
			return "Campaign sporting award is invalid."
		rows.append({"person_id": award.get("person_id"), "team_id": award.get("team_id"), "car_id": _car_for_person(data, award.get("person_id"))})
	return _field_mapping_error(data, _entrant_for_person(data, rows[0].get("person_id", "")) if not rows.is_empty() else "", rows)

static func _accepted_people(data: Dictionary) -> Dictionary:
	var expected = {}
	for entry in data.entries.values():
		if entry.status != "accepted":
			continue
		for index in range(entry.person_ids.size()):
			expected[entry.person_ids[index]] = {"team_id": entry.team_id, "car_id": entry.car_ids[index]}
	return expected

static func _entrant_for_person(data: Dictionary, person_id: String) -> String:
	for entry in data.entries.values():
		if entry.status == "accepted" and person_id in entry.person_ids:
			return entry.entrant_id
	return ""

static func _car_for_person(data: Dictionary, person_id: String) -> String:
	for entry in data.entries.values():
		if entry.status != "accepted":
			continue
		var index = entry.person_ids.find(person_id)
		if index >= 0:
			return entry.car_ids[index]
	return ""

static func _accumulate(rows: Dictionary, identity: String, award: Dictionary, rules: Dictionary) -> void:
	if not rows.has(identity):
		var counts: Array = []
		counts.resize(int(rules.countback_depth))
		counts.fill(0)
		rows[identity] = {
			"points": 0,
			"starts": 0,
			"wins": 0,
			"best_position": CampaignWeekendReceipt.MAX_ENTRANTS + 1,
			"finish_counts": counts
		}
	var row: Dictionary = rows[identity]
	row.points = int(row.points) + int(award.points)
	row.starts = int(row.starts) + 1
	row.wins = int(row.wins) + (1 if int(award.position) == 1 else 0)
	row.best_position = mini(int(row.best_position), int(award.position))
	if int(award.position) <= row.finish_counts.size():
		row.finish_counts[int(award.position) - 1] = int(row.finish_counts[int(award.position) - 1]) + 1

static func _rank(rows: Dictionary, depth: int) -> Array:
	var identities = rows.keys()
	var ordered: Array = []
	for identity in identities:
		var inserted = false
		for index in range(ordered.size()):
			var comparison = _compare(rows[identity], rows[ordered[index]], depth)
			if comparison < 0 or (comparison == 0 and str(identity) < str(ordered[index])):
				ordered.insert(index, identity)
				inserted = true
				break
		if not inserted:
			ordered.append(identity)
	var result: Array = []
	var index = 0
	while index < ordered.size():
		var end = index + 1
		while end < ordered.size() and _compare(rows[ordered[index]], rows[ordered[end]], depth) == 0:
			end += 1
		var shared = end - index > 1
		for member in range(index, end):
			var identity = ordered[member]
			result.append({
				"identity": identity,
				"position": index + 1,
				"shared": shared,
				"points": int(rows[identity].points)
			})
		index = end
	return result

static func _compare(left: Dictionary, right: Dictionary, depth: int) -> int:
	if int(left.points) != int(right.points):
		return -1 if int(left.points) > int(right.points) else 1
	for index in range(depth):
		var left_count = int(left.finish_counts[index])
		var right_count = int(right.finish_counts[index])
		if left_count != right_count:
			return -1 if left_count > right_count else 1
	return 0

static func _seal(data: Dictionary) -> void:
	data.erase("digest")
	data["digest"] = RaceStateValue.fingerprint(data)

static func _reject(message: String, current: Dictionary) -> Dictionary:
	return {"ok": false, "status": "rejected", "error": message, "season": current.duplicate(true)}
