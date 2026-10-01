class_name RaceContentSnapshot
extends RefCounted
## Explicit content-metadata boundary; never copies arbitrary checkpoint keys into options.
const RULE_KEYS = ["vehicle_definition", "roster_definition", "tyre_definition", "setup_definition", "tuning_definition", "weekend_definition", "mechanic_definition", "performance_profiles"]

static func options(data: Dictionary) -> Dictionary:
	var result: Dictionary = {}
	if data.has("weekend_definition"):
		var preset = WeekendDefinition.from_record(data.weekend_definition)
		if preset != null: result = preset.launch_options()
	for key in RULE_KEYS:
		if key == "vehicle_definition": continue
		if data.has(key): result[key] = data[key]
	return result

static func valid_mechanics(data: Dictionary) -> bool:
	var selected: MechanicProfileDefinition
	if data.has("mechanic_definition"):
		selected = MechanicProfileDefinition.from_record(data.mechanic_definition)
		if selected == null: return false
	var weekend = data.get("weekend_definition", {})
	if not weekend is Dictionary: return false
	if weekend.has("mechanic_profile_id"):
		return selected != null and selected.id == weekend.mechanic_profile_id
	return true
