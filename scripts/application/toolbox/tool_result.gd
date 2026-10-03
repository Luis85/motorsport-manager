class_name DeveloperToolResult
extends RefCounted
## Detached values shared by the native developer API and its JSON transport.


static func success(value: Variant) -> Dictionary:
	if not RaceStateValue.serializable(value):
		return failure("INVALID_RESULT", "Operation returned a non-JSON value.")
	return {"ok": true, "result": _json_copy(value)}


static func failure(code: String, message: String, details: Dictionary = {}) -> Dictionary:
	var safe_details: Dictionary = {}
	if RaceStateValue.serializable(details):
		safe_details = _json_copy(details)
	return {"ok": false, "error": {"code": code, "message": message, "details": safe_details}}


static func _json_copy(value: Variant) -> Variant:
	# Native authored documents use StringName keys; the public JSON contract uses strings.
	# Keep exact integers and floating-point values, unlike a stringify/parse round trip.
	if value is Dictionary:
		var result: Dictionary = {}
		for key in value:
			result[str(key)] = _json_copy(value[key])
		return result
	if value is Array:
		var result: Array = []
		for item in value:
			result.append(_json_copy(item))
		return result
	return str(value) if typeof(value) == TYPE_STRING_NAME else value


static func identifier(value: Variant) -> bool:
	if not value is String or value.is_empty() or value.length() > 64:
		return false
	for index in value.length():
		var character: int = value.unicode_at(index)
		var alphanumeric: bool = (
			(character >= 48 and character <= 57)
			or (character >= 65 and character <= 90)
			or (character >= 97 and character <= 122)
		)
		if not alphanumeric and (index == 0 or character not in [45, 46, 95]):
			return false
	return true


static func integral(value: Variant, minimum: int, maximum: int) -> bool:
	if typeof(value) not in [TYPE_INT, TYPE_FLOAT]:
		return false
	return is_finite(float(value)) and value >= minimum and value <= maximum and value == int(value)
