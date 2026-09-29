class_name WeekendDefinition
extends RefCounted
## Named configurations of the supported practice-to-results journey; not executable phases.
const REFERENCES = {"vehicle_id": "vehicle", "roster_id": "roster", "tyre_allocation_id": "tyre_allocation", "setup_id": "setup", "race_tuning_id": "race_tuning"}
var _record: Dictionary = {}
var id: String:
	get: return _record.id
var vehicle_id: String:
	get: return _record.vehicle_id

static func fields() -> Dictionary:
	var fields: Dictionary = {}
	for key in REFERENCES: fields[key] = ContentSchema.identity()
	fields.settings = ContentSchema.object({
		"laps": ContentSchema.integer(1, 100), "seed": ContentSchema.integer(0, 4294967295),
		"qual_duration": ContentSchema.number(120, 1800),
		"scenario": {"enum": ["dry", "wet", "changeable"]},
		"intensity": {"enum": ["calm", "standard", "volatile"]},
		"weather_mode": {"enum": ["seeded", "scripted_training"]},
		"rival_styles": {"type": "boolean"}, "tactical_duels": {"type": "boolean"}})
	return fields

static func from_record(record: Variant) -> WeekendDefinition:
	if not record is Dictionary: return null
	if not ContentValidation.check(record, ContentSchema.definition("weekend")).is_empty(): return null
	var value = WeekendDefinition.new()
	value._record = RaceStateValue.read_only(record)
	return value

func to_record() -> Dictionary:
	return _record.duplicate(true)

func launch_options() -> Dictionary:
	var result: Dictionary = _record.settings.duplicate(true)
	for key in REFERENCES:
		if key != "vehicle_id": result[key] = _record[key]
	return result

static func agrees_with_snapshot(data: Dictionary) -> bool:
	if not data.has("weekend_definition"): return true
	var definition = from_record(data.weekend_definition)
	if definition == null: return false
	var record = definition.to_record()
	for key in ["roster_definition", "tyre_definition", "setup_definition", "tuning_definition"]:
		if not data.get(key) is Dictionary: return false
	if not data.roster_definition.get("roster") is Dictionary: return false
	if not data.tyre_definition.get("allocation") is Dictionary: return false
	if data.get("vehicle") != record.vehicle_id: return false
	if data.get("roster_definition", {}).get("roster", {}).get("id") != record.roster_id: return false
	if data.get("tyre_definition", {}).get("allocation", {}).get("id") != record.tyre_allocation_id: return false
	if data.get("setup_definition", {}).get("id") != record.setup_id: return false
	if data.get("tuning_definition", {}).get("id") != record.race_tuning_id: return false
	for key in ["laps", "scenario", "intensity"]:
		if data.get(key) != record.settings[key]: return false
	if data.get("seed_value") != record.settings.seed: return false
	if data.has("weather_state"):
		if not data.weather_state is Dictionary or not data.weather_state.get("model") is Dictionary: return false
		if data.weather_state.model.get("mode") != record.settings.weather_mode: return false
	if data.has("rival_styles"):
		if not data.rival_styles is Dictionary or data.rival_styles.get("enabled") != record.settings.rival_styles: return false
	if data.has("duel_state"):
		if not data.duel_state is Dictionary or data.duel_state.get("enabled") != record.settings.tactical_duels: return false
	return true
