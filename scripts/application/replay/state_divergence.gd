class_name StateDivergence
extends RefCounted
## Diagnostic comparison only. Uses the established replay numeric tolerance.
## Missing values are distinguished from recorded nulls; no causal attribution.


static func first(expected: Variant, observed: Variant, path: String = "") -> Dictionary:
	if expected is Dictionary and observed is Dictionary:
		var keys = expected.keys()
		for key in observed:
			if key not in keys:
				keys.append(key)
		keys.sort()
		for key in keys:
			var next = str(key) if path.is_empty() else path + "." + str(key)
			if not expected.has(key) or not observed.has(key):
				return _difference(
					next, expected.get(key), observed.get(key), expected.has(key), observed.has(key)
				)
			var result = first(expected[key], observed[key], next)
			if not result.is_empty():
				return result
		return {}
	if expected is Array and observed is Array:
		for index in mini(expected.size(), observed.size()):
			var result = first(expected[index], observed[index], "%s[%d]" % [path, index])
			if not result.is_empty():
				return result
		if expected.size() != observed.size():
			return _difference(path + ".length", expected.size(), observed.size())
		return {}
	if RaceRecord.equivalent(expected, observed):
		return {}
	return _difference(path, expected, observed)


static func _difference(
	path: String,
	expected: Variant,
	observed: Variant,
	expected_present: bool = true,
	observed_present: bool = true
) -> Dictionary:
	return {
		"path": path,
		"expected": RaceStateValue.copy(expected),
		"observed": RaceStateValue.copy(observed),
		"expected_present": expected_present,
		"observed_present": observed_present
	}
