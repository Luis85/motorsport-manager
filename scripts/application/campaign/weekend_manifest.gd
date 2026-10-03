class_name CampaignWeekendManifest
extends RefCounted
## Immutable campaign-to-race entry identity. It freezes only information the
## existing weekend can prove; campaign economy and championship rules stay external.
const KIND = "motorsport-manager-campaign-weekend-manifest"
const VERSION = 1
const MAX_ENTRANTS = 24


static func build(context: Dictionary, record: RaceRecord, mappings: Array) -> Dictionary:
	if record == null or not RaceRecord.valid_id(record.event_id):
		return {}
	if not record.initial is Dictionary or record.initial.is_empty():
		return {}
	var race = RaceRecord.manifest_for(record.initial)
	var ordered = mappings.duplicate(true)
	ordered.sort_custom(func(a, b): return int(a.get("race_id", -1)) < int(b.get("race_id", -1)))
	var data = {
		"kind": KIND,
		"version": VERSION,
		"campaign_id": context.get("campaign_id"),
		"season_id": context.get("season_id"),
		"campaign_event_id": context.get("campaign_event_id"),
		"entrant_id": context.get("entrant_id"),
		"event_revision": context.get("event_revision"),
		"departure_slot": context.get("departure_slot"),
		"return_slot": context.get("return_slot"),
		"race_event_id": record.event_id,
		"race_model": RaceRecord.model_for(record.initial),
		"checkpoint_version": int(record.initial.get("version", 0)),
		"track_hash": race.get("track_hash", ""),
		"roster_hash": race.get("roster_hash", ""),
		"starting_resources_hash": race.get("starting_resources_hash", ""),
		"ruleset_hash": RaceRecord.fingerprint(race.get("ruleset", {})),
		"mappings": ordered
	}
	data["digest"] = RaceRecord.fingerprint(data)
	return data if validate(data).is_empty() else {}


static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign entry exceeds serialized-value limits."
	if not data is Dictionary or data.size() != 18:
		return "Campaign entry has an unsupported shape."
	if (
		data.get("kind") != KIND
		or not RaceCheckpoint.integral(data.get("version"), VERSION, VERSION)
	):
		return "Unsupported campaign entry format."
	for key in ["campaign_id", "season_id", "campaign_event_id", "entrant_id"]:
		if not valid_stable_id(data.get(key)):
			return "Invalid campaign identity: " + key + "."
	if not RaceCheckpoint.integral(data.get("event_revision"), 1, 2147483647):
		return "Campaign event revision must be a positive integer."
	if (
		not RaceCheckpoint.integral(data.get("departure_slot"), 0, 2147483647)
		or not RaceCheckpoint.integral(data.get("return_slot"), 1, 2147483647)
	):
		return "Campaign departure and return slots are invalid."
	if int(data.return_slot) <= int(data.departure_slot):
		return "Campaign return must follow departure."
	var race_evidence_error = _race_evidence_error(data)
	if not race_evidence_error.is_empty():
		return race_evidence_error
	var mapping_error = validate_mappings(data.get("mappings"))
	if not mapping_error.is_empty():
		return mapping_error
	var content = data.duplicate(true)
	content.erase("digest")
	if not valid_hash(data.get("digest")) or data.digest != RaceRecord.fingerprint(content):
		return "Campaign entry integrity check failed."
	return ""


static func validate_mappings(value: Variant) -> String:
	if not value is Array or value.size() < 2 or value.size() > MAX_ENTRANTS:
		return "Campaign entry must map between 2 and 24 race entrants."
	var race_ids = {}
	var people = {}
	var cars = {}
	for row in value:
		if not row is Dictionary or row.size() != 4:
			return "Campaign entrant mapping has an unsupported shape."
		if not RaceCheckpoint.integral(row.get("race_id"), 0, value.size() - 1):
			return "Campaign entrant mapping has an invalid race identity."
		var race_id = int(row.race_id)
		if race_ids.has(race_id):
			return "Campaign entrant mapping repeats a race identity."
		race_ids[race_id] = true
		for key in ["person_id", "team_id", "car_id"]:
			if not valid_stable_id(row.get(key)):
				return "Campaign entrant mapping has an invalid " + key + "."
		if people.has(row.person_id) or cars.has(row.car_id):
			return "Campaign entrant mapping repeats a person or car identity."
		people[row.person_id] = true
		cars[row.car_id] = true
	for race_id in range(value.size()):
		if not race_ids.has(race_id):
			return "Campaign entrant mapping must cover every race identity exactly once."
	return ""


static func valid_stable_id(value: Variant) -> bool:
	if not value is String or value.is_empty() or value.length() > 96:
		return false
	for character in value:
		if character not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-":
			return false
	return true


static func valid_hash(value: Variant) -> bool:
	return value is String and value.length() == 64 and value.is_valid_hex_number(false)


static func _race_evidence_error(data: Dictionary) -> String:
	if not RaceRecord.valid_id(data.get("race_event_id")):
		return "Missing frozen race event identity."
	if (
		not data.get("race_model") is String
		or data.race_model.is_empty()
		or data.race_model.length() > 100
	):
		return "Missing frozen race model."
	if not RaceCheckpoint.integral(data.get("checkpoint_version"), 10, 12):
		return "Unsupported frozen race checkpoint."
	for key in ["track_hash", "roster_hash", "starting_resources_hash", "ruleset_hash"]:
		if not valid_hash(data.get(key)):
			return "Invalid frozen hash: " + key + "."
	return ""
