extends RefCounted
## Detached state comparison for JSON continuations; numeric tolerances are explicit.


static func equivalent(
	a: Variant,
	b: Variant,
	tolerance: float = 0.00000001,
	inclusive: bool = true,
	strict_types: bool = false
) -> bool:
	if a is RaceCar and b is RaceCar:
		return equivalent(a.to_record(), b.to_record(), tolerance, inclusive, strict_types)
	if (a is int or a is float) and (b is int or b is float):
		var difference = absf(float(a) - float(b))
		return difference <= tolerance if inclusive else difference < tolerance
	if strict_types and typeof(a) != typeof(b):
		return false
	if a is Dictionary and b is Dictionary:
		return dictionaries(a, b, tolerance, inclusive, strict_types)
	if a is Array and b is Array:
		return arrays(a, b, tolerance, inclusive, strict_types)
	return a == b


static func dictionaries(
	a: Dictionary, b: Dictionary, tolerance: float, inclusive: bool, strict_types: bool
) -> bool:
	if a.size() != b.size():
		return false
	for key in a:
		if not b.has(key) or not equivalent(a[key], b[key], tolerance, inclusive, strict_types):
			return false
	return true


static func arrays(
	a: Array, b: Array, tolerance: float, inclusive: bool, strict_types: bool
) -> bool:
	if a.size() != b.size():
		return false
	for i in range(a.size()):
		if not equivalent(a[i], b[i], tolerance, inclusive, strict_types):
			return false
	return true
