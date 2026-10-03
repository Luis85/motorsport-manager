class_name DeveloperFacetValues
extends RefCounted
## Shared bounded JSON arguments and process-local identity for editor/campaign facets.
const MAX_SESSIONS = 32


static func object(properties: Dictionary = {}, required: Array = []) -> Dictionary:
	return {
		"type": "object",
		"properties": properties,
		"required": required,
		"additionalProperties": false
	}


static func document() -> Dictionary:
	return {"type": "object", "description": "Detached document validated by its domain owner."}


static func descriptor(
	operation: String,
	method: String,
	description: String,
	arguments: Dictionary,
	clock: String = "none"
) -> Dictionary:
	return {
		"operation": operation,
		"method": method,
		"description": description,
		"arguments": arguments,
		"clock": clock,
		"persistence": "memory",
		"examples": []
	}


static func argument_error(arguments: Dictionary, schema: Dictionary) -> Dictionary:
	if not RaceStateValue.serializable(arguments):
		return DeveloperToolResult.failure("INVALID_ARGUMENT", "Use bounded finite JSON values.")
	var diagnostics = ContentValidation.check(arguments, schema)
	if not diagnostics.is_empty():
		return DeveloperToolResult.failure(
			"INVALID_ARGUMENT",
			"Arguments do not match this operation.",
			{"diagnostics": diagnostics}
		)
	return {}
