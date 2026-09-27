class_name RaceStateValue
extends RefCounted
## Copies serialization values without retaining caller-owned mutable collections.

static func copy(value: Variant) -> Variant:
	if value is Array or value is Dictionary:
		return value.duplicate(true)
	if typeof(value) in [TYPE_PACKED_BYTE_ARRAY, TYPE_PACKED_INT32_ARRAY,
		TYPE_PACKED_INT64_ARRAY, TYPE_PACKED_FLOAT32_ARRAY, TYPE_PACKED_FLOAT64_ARRAY,
		TYPE_PACKED_STRING_ARRAY, TYPE_PACKED_VECTOR2_ARRAY, TYPE_PACKED_VECTOR3_ARRAY,
		TYPE_PACKED_COLOR_ARRAY]:
		return value.duplicate()
	return value

static func read_only(value: Variant) -> Variant:
	## Signal subscribers receive independent, recursively read-only records.
	## Engine objects are deliberately outside this serialization-value contract.
	if value is Dictionary:
		var result: Dictionary = {}
		for key in value:
			result[key] = read_only(value[key])
		result.make_read_only()
		return result
	if value is Array:
		var result: Array = []
		for item in value:
			result.append(read_only(item))
		result.make_read_only()
		return result
	return copy(value)

static func fingerprint(value: Variant) -> String:
	## Stable JSON-value digest. Does not identify events or draw randomness.
	return JSON.stringify(JSON.parse_string(JSON.stringify(value, "", true, true)), "", true, true).sha256_text()
