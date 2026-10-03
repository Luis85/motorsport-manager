class_name ContentValidation
extends RefCounted
## The same pure schema validator is used by file loading and frozen-save decoding.
## Implements the bounded vocabulary emitted by ContentSchema, not all JSON Schema.
const MAX_DIAGNOSTICS = 64


static func check(value: Variant, schema: Dictionary, path: String = "") -> Array:
	var errors: Array = []
	_inspect(value, schema, path, errors, 0, [0])
	return errors


static func diagnostic(code: String, path: String, message: String) -> Dictionary:
	return {"severity": "error", "code": code, "field": path, "message": message}


static func _inspect(
	value: Variant, schema: Dictionary, path: String, errors: Array, depth: int, budget: Array
) -> void:
	if errors.size() >= MAX_DIAGNOSTICS:
		return
	budget[0] += 1
	if depth > 24 or budget[0] > 20000:
		errors.append(diagnostic("CONTENT_LIMIT", path, "Content exceeds structural limits."))
		return
	if schema.has("enum") and not _enum_has(schema.enum, value):
		errors.append(
			diagnostic("CONTENT_ENUM", path, "Choose one of " + JSON.stringify(schema.enum))
		)
		return
	var type = str(schema.get("type", ""))
	if not type.is_empty() and not _matches(value, type):
		errors.append(
			diagnostic(
				"CONTENT_TYPE", path, "Expected " + type + "; got " + type_string(typeof(value))
			)
		)
		return
	if type in ["number", "integer"]:
		if (
			not is_finite(value)
			or value < schema.get("minimum", -INF)
			or value > schema.get("maximum", INF)
		):
			errors.append(
				diagnostic("CONTENT_RANGE", path, "Number is outside the supported range.")
			)
	elif type == "string":
		_inspect_string(value, schema, path, errors)
	elif type == "array":
		_inspect_array(value, schema, path, errors, depth, budget)
	elif type == "object":
		_inspect_object(value, schema, path, errors, depth, budget)


static func _matches(value: Variant, type: String) -> bool:
	match type:
		"number":
			return typeof(value) in [TYPE_FLOAT, TYPE_INT]
		"integer":
			return (
				typeof(value) in [TYPE_FLOAT, TYPE_INT]
				and is_finite(value)
				and float(value) == floorf(float(value))
			)
		"string":
			return value is String
		"boolean":
			return value is bool
		"array":
			return value is Array
		"object":
			return value is Dictionary
	return false


static func _enum_has(choices: Array, value: Variant) -> bool:
	for choice in choices:
		if typeof(value) == typeof(choice) and value == choice:
			return true
		if (
			typeof(value) in [TYPE_FLOAT, TYPE_INT]
			and typeof(choice) in [TYPE_FLOAT, TYPE_INT]
			and value == choice
		):
			return true
	return false


static func _inspect_string(
	value: Variant, schema: Dictionary, path: String, errors: Array
) -> void:
	if (
		value.length() < schema.get("minLength", 0)
		or value.length() > schema.get("maxLength", 8192)
	):
		errors.append(diagnostic("CONTENT_LENGTH", path, "Text is outside the supported length."))
	if schema.has("pattern"):
		var pattern = RegEx.new()
		pattern.compile(schema.pattern)
		if pattern.search(value) == null:
			errors.append(
				diagnostic("CONTENT_PATTERN", path, "Text must match " + str(schema.pattern))
			)


static func _inspect_array(
	value: Variant, schema: Dictionary, path: String, errors: Array, depth: int, budget: Array
) -> void:
	if value.size() < schema.get("minItems", 0) or value.size() > schema.get("maxItems", 2048):
		errors.append(diagnostic("CONTENT_COUNT", path, "Array is outside the supported size."))
		return
	for index in range(value.size()):
		_inspect(
			value[index],
			schema.get("items", {}),
			path + "/" + str(index),
			errors,
			depth + 1,
			budget
		)


static func _inspect_object(
	value: Variant, schema: Dictionary, path: String, errors: Array, depth: int, budget: Array
) -> void:
	var properties: Dictionary = schema.get("properties", {})
	for required in schema.get("required", []):
		if errors.size() >= MAX_DIAGNOSTICS:
			return
		if not value.has(required):
			errors.append(
				diagnostic("CONTENT_REQUIRED", path + "/" + required, "Required field is missing.")
			)
	for key in value:
		if errors.size() >= MAX_DIAGNOSTICS:
			return
		if not key is String:
			errors.append(diagnostic("CONTENT_KEY", path, "Object keys must be strings."))
			return
		var child = path + "/" + key.replace("~", "~0").replace("/", "~1")
		if properties.has(key):
			_inspect(value[key], properties[key], child, errors, depth + 1, budget)
		elif schema.get("additionalProperties", true) == false:
			errors.append(
				diagnostic(
					"CONTENT_UNKNOWN_FIELD",
					child,
					"Unknown field; check spelling or schema version."
				)
			)
