class_name DeveloperWeekendDispatch
extends RefCounted
## Explicit transport mapping with type preflight before native capability methods.


static func execute(
	facet: DeveloperWeekends, operation: String, session: String, arguments: Dictionary
) -> Dictionary:
	if not DeveloperWeekendDescriptors.ARGUMENTS.has(operation):
		return DeveloperToolResult.failure(
			"UNKNOWN_OPERATION", "Unknown weekend operation: " + operation
		)
	var error = _argument_error(operation, arguments)
	if not error.is_empty():
		return DeveloperToolResult.failure("INVALID_ARGUMENT", error)
	return _invoke(facet, operation, session, arguments)


static func _argument_error(operation: String, arguments: Dictionary) -> String:
	if not RaceStateValue.serializable(arguments):
		return "Arguments must contain bounded finite serialized values."
	var schema = DeveloperWeekendDescriptors.schema(operation)
	for key in schema.required:
		if not arguments.has(key):
			return "Missing weekend argument: " + str(key)
	for key in arguments:
		if not schema.properties.has(key):
			return "Unsupported weekend argument: " + str(key)
		if not _matches(arguments[key], schema.properties[key].type):
			return "Wrong type for weekend argument: " + str(key)
	return ""


static func _matches(value: Variant, kind: String) -> bool:
	match kind:
		"object":
			return value is Dictionary
		"string":
			return value is String
	return typeof(value) in [TYPE_INT, TYPE_FLOAT]


static func _invoke(
	facet: DeveloperWeekends, operation: String, session: String, arguments: Dictionary
) -> Dictionary:
	match operation:
		"weekend.create":
			return facet.create(session, arguments.configuration)
		"weekend.restore":
			return facet.restore(session, arguments.snapshot)
		"weekend.command":
			return facet.command(session, arguments.action, arguments.get("payload", {}))
		"weekend.query":
			return facet.query(
				session, arguments.get("view", "state"), arguments.get("parameters", {})
			)
		"weekend.step_ticks":
			return facet.step_ticks(session, arguments.count)
		"weekend.advance_elapsed":
			return facet.advance_elapsed(session, arguments.seconds)
		"weekend.snapshot":
			return facet.snapshot(session)
		"weekend.recording":
			return facet.recording(session)
		"weekend.events":
			return facet.events(session)
	return facet.close(session)
