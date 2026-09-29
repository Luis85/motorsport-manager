class_name RaceContentSnapshot
extends RefCounted
## Explicit content-metadata boundary; never copies arbitrary checkpoint keys into options.
static func options(data: Dictionary) -> Dictionary:
	var result: Dictionary = {}
	if data.has("weekend_definition"):
		var preset = WeekendDefinition.from_record(data.weekend_definition)
		if preset != null: result = preset.launch_options()
	for key in ["roster_definition", "tyre_definition", "setup_definition", "tuning_definition", "weekend_definition"]:
		if data.has(key): result[key] = data[key]
	return result
