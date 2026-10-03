class_name CampaignSeasonEntries
extends RefCounted
## Stable entry lifecycle and complete accepted person/team/car field mapping.
const ENTRY_STATUSES = ["submitted", "accepted", "rejected", "withdrawn"]
const MAX_RECORDS = CampaignSeriesRules.MAX_ENTRANTS * 2


static func submit(current: Dictionary, input: Dictionary, rules: Dictionary) -> Dictionary:
	if current.size() >= MAX_RECORDS or _live_count(current) >= int(rules.max_entrants):
		return _reject("Campaign season entry registry is full.", current)
	var entrant_id = input.get("entrant_id")
	if not CampaignIdentity.valid(entrant_id) or current.has(entrant_id):
		return _reject(
			"Campaign season entry has an invalid or repeated entrant identity.", current
		)
	var record = {
		"entrant_id": entrant_id,
		"team_id": input.get("team_id"),
		"person_ids": input.get("person_ids", []),
		"car_ids": input.get("car_ids", []),
		"status": "submitted"
	}
	var error = _entry_error(record, rules)
	if not error.is_empty():
		return _reject(error, current)
	error = _conflict_error(current, record)
	if not error.is_empty():
		return _reject(error, current)
	var candidate = current.duplicate(true)
	candidate[entrant_id] = record.duplicate(true)
	return {"ok": true, "status": "submitted", "error": "", "entries": candidate}


static func decide(current: Dictionary, entrant_id: String, accept: bool) -> Dictionary:
	if not current.has(entrant_id) or current[entrant_id].status != "submitted":
		return _reject("Campaign entry decision requires one submitted entry.", current)
	var candidate = current.duplicate(true)
	var record: Dictionary = candidate[entrant_id]
	record.status = "accepted" if accept else "rejected"
	candidate[entrant_id] = record
	return {"ok": true, "status": record.status, "error": "", "entries": candidate}


static func withdraw(current: Dictionary, entrant_id: String) -> Dictionary:
	if not current.has(entrant_id) or current[entrant_id].status not in ["submitted", "accepted"]:
		return _reject("Campaign entry can be withdrawn only before entries close.", current)
	var candidate = current.duplicate(true)
	var record: Dictionary = candidate[entrant_id]
	record.status = "withdrawn"
	candidate[entrant_id] = record
	return {"ok": true, "status": "withdrawn", "error": "", "entries": candidate}


static func validate(value: Variant, rules: Dictionary) -> String:
	if not value is Dictionary or value.size() > MAX_RECORDS:
		return "Campaign season entry registry is invalid."
	var live_people = {}
	var live_cars = {}
	var live_teams = {}
	for entrant_id in value:
		var entry = value[entrant_id]
		if not entry is Dictionary:
			return _entry_error(entry, rules)
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
	if _live_count(value) > int(rules.max_entrants):
		return "Campaign season has too many live entries."
	return ""


static func gate_error(entries: Dictionary, rules: Dictionary) -> String:
	var accepted = 0
	for entry in entries.values():
		if entry.status == "submitted":
			return "Campaign season cannot close entries while a submission is undecided."
		if entry.status == "accepted":
			accepted += 1
	if accepted < int(rules.min_entrants) or accepted > int(rules.max_entrants):
		return "Campaign season does not have the required accepted entrants."
	return ""


static func field_mapping_error(entries: Dictionary, entrant_id: Variant, rows: Variant) -> String:
	if (
		not CampaignIdentity.valid(entrant_id)
		or not entries.has(entrant_id)
		or entries[entrant_id].status != "accepted"
	):
		return "Campaign weekend entrant is not accepted for the season."
	if not rows is Array:
		return "Campaign weekend field mapping is invalid."
	var expected = accepted_people(entries)
	if rows.size() != expected.size():
		return "Campaign weekend field does not cover every accepted season car."
	var seen = {}
	for row in rows:
		if (
			not row is Dictionary
			or not expected.has(row.get("person_id"))
			or seen.has(row.person_id)
		):
			return "Campaign weekend field has an unknown or repeated season person."
		seen[row.person_id] = true
		var identity: Dictionary = expected[row.person_id]
		if row.get("team_id") != identity.team_id or row.get("car_id") != identity.car_id:
			return "Campaign weekend field differs from accepted season entries."
	return ""


static func awards_mapping_error(entries: Dictionary, awards: Variant) -> String:
	if not awards is Array:
		return "Campaign sporting awards are invalid."
	var expected = accepted_people(entries)
	if awards.size() != expected.size():
		return "Campaign sporting awards do not cover every accepted season car."
	var seen = {}
	for award in awards:
		if (
			not award is Dictionary
			or not expected.has(award.get("person_id"))
			or seen.has(award.person_id)
		):
			return "Campaign sporting awards have an unknown or repeated season person."
		seen[award.person_id] = true
		if award.get("team_id") != expected[award.person_id].team_id:
			return "Campaign sporting awards differ from accepted season teams."
	return ""


static func accepted_people(entries: Dictionary) -> Dictionary:
	var expected = {}
	for entry in entries.values():
		if entry.status != "accepted":
			continue
		for index in range(entry.person_ids.size()):
			expected[entry.person_ids[index]] = {
				"team_id": entry.team_id, "car_id": entry.car_ids[index]
			}
	return expected


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


static func _conflict_error(entries: Dictionary, candidate: Dictionary) -> String:
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


static func _live_count(entries: Dictionary) -> int:
	var count = 0
	for entry in entries.values():
		if entry.status in ["submitted", "accepted"]:
			count += 1
	return count


static func _reject(message: String, current: Dictionary) -> Dictionary:
	return {"ok": false, "status": "rejected", "error": message, "entries": current.duplicate(true)}
