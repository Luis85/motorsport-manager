class_name RaceContentSnapshot
extends RefCounted
## Explicit content-metadata boundary; never copies arbitrary checkpoint keys into options.
static func options(data: Dictionary) -> Dictionary:
	var result: Dictionary = {}
	for key in ["roster_definition", "tyre_definition", "setup_definition"]:
		if data.has(key): result[key] = data[key]
	return result
