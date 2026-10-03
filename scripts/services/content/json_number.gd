class_name JsonNumber
extends RefCounted
## Correctly rounded decimal-to-binary64 conversion for persisted JSON numbers.
## Godot's decimal parser can drift one ULP on repeated decoding. Never round race
## state or weaken its digest: compare its approximation with exact dyadic bounds.
## Unsigned integers use little-endian base-2^15 limbs; no executable serialization.
const BASE = 32768
const MASK = BASE - 1
const FRACTION_MASK = 0x000fffffffffffff
const MAX_FINITE = 0x7fefffffffffffff


static func parse(token: String) -> Dictionary:
	var negative = token.begins_with("-")
	var unsigned = token.substr(1) if negative else token
	var pieces = unsigned.to_lower().split("e")
	var exponent = int(pieces[1]) if pieces.size() == 2 else 0
	var mantissa: String = pieces[0]
	var dot = mantissa.find(".")
	if dot >= 0:
		exponent -= mantissa.length() - dot - 1
		mantissa = mantissa.replace(".", "")
	while mantissa.begins_with("0") and mantissa.length() > 1:
		mantissa = mantissa.substr(1)
	while mantissa.ends_with("0") and mantissa.length() > 1:
		mantissa = mantissa.left(-1)
		exponent += 1
	if mantissa == "0":
		return {"ok": true, "value": _from_bits(0, negative)}
	if exponent > 400 or exponent < -500 or mantissa.length() > 100:
		return {"ok": false, "error": "JSON number exceeds the conversion limits."}
	# Integer-valued JSON below 2^53 needs no rounding or large integer work.
	if exponent >= 0 and mantissa.length() + exponent <= 15:
		var integer = int(mantissa)
		for index in range(exponent):
			integer *= 10
		return {"ok": true, "value": -float(integer) if negative else float(integer)}
	var numerator: Array[int] = [0]
	for digit in mantissa:
		numerator = _multiply_small(numerator, 10, digit.unicode_at(0) - 48)
	var denominator: Array[int] = [1]
	for index in range(absi(exponent)):
		if exponent >= 0:
			numerator = _multiply_small(numerator, 10)
		else:
			denominator = _multiply_small(denominator, 10)
	# Avoid feeding out-of-range exponents into the engine's approximation parser.
	var decimal_order = mantissa.length() + exponent - 1
	if decimal_order >= 309:
		return {"ok": false, "error": "JSON numbers must be finite."}
	var digits = mantissa.left(17)
	var approximation = float(int(digits))
	var remaining = exponent + mantissa.length() - digits.length()
	# Scale in bounded chunks: the engine parser underflows very small literals
	# and counts leading decimal zeroes against its significand digit budget.
	while remaining != 0:
		var part = clampi(remaining, -150, 150)
		approximation *= pow(10.0, part)
		remaining -= part
	return _rounded_value(numerator, denominator, approximation, negative)


static func _multiply_small(value: Array[int], factor: int, carry: int = 0) -> Array[int]:
	var result: Array[int] = []
	for limb in value:
		var product = limb * factor + carry
		result.append(product & MASK)
		carry = product >> 15
	while carry > 0:
		result.append(carry & MASK)
		carry >>= 15
	return result


static func _shift(value: Array[int], count: int) -> Array[int]:
	var result: Array[int] = []
	result.resize(count / 15)
	result.fill(0)
	result.append_array(_multiply_small(value, 1 << (count % 15)))
	return result


static func _multiply_integer(value: Array[int], factor: int) -> Array[int]:
	var result: Array[int] = []
	result.resize(value.size() + 4)
	result.fill(0)
	var offset = 0
	while factor > 0:
		var digit = factor & MASK
		var carry = 0
		for index in range(value.size()):
			var product = result[index + offset] + value[index] * digit + carry
			result[index + offset] = product & MASK
			carry = product >> 15
		result[value.size() + offset] = carry
		offset += 1
		factor >>= 15
	while result.size() > 1 and result.back() == 0:
		result.pop_back()
	return result


static func _compare(a: Array[int], b: Array[int]) -> int:
	if a.size() != b.size():
		return -1 if a.size() < b.size() else 1
	for index in range(a.size() - 1, -1, -1):
		if a[index] != b[index]:
			return -1 if a[index] < b[index] else 1
	return 0


static func _compare_dyadic(
	numerator: Array[int], denominator: Array[int], significand: int, exponent: int
) -> int:
	var right = _multiply_integer(denominator, significand)
	if exponent >= 0:
		return _compare(numerator, _shift(right, exponent))
	return _compare(_shift(numerator, -exponent), right)


static func _from_bits(bits: int, negative: bool) -> float:
	var bytes = PackedByteArray()
	bytes.resize(8)
	bytes.encode_u64(0, bits | (1 << 63) if negative else bits)
	return bytes.decode_double(0)


static func _rounded_value(
	numerator: Array[int], denominator: Array[int], approximation: float, negative: bool
) -> Dictionary:
	var bytes = PackedByteArray()
	bytes.resize(8)
	bytes.encode_double(0, absf(approximation))
	var bits = mini(bytes.decode_u64(0), MAX_FINITE)
	var low = 0
	var high = MAX_FINITE
	# A bounded binary search covers hosts with less accurate approximations.
	for attempt in range(80):
		if attempt >= 16:
			bits = low + (high - low) / 2
		var raw_exponent = (bits >> 52) & 2047
		var significand = bits & FRACTION_MASK
		var binary_exponent = -1074
		if raw_exponent > 0:
			significand |= 1 << 52
			binary_exponent = raw_exponent - 1075
		var odd = (bits & 1) == 1
		if bits > 0:
			var lower_m = significand * 2 - 1
			var lower_e = binary_exponent - 1
			if (bits & FRACTION_MASK) == 0 and raw_exponent > 1:
				lower_m = significand * 4 - 1
				lower_e = binary_exponent - 2
			var lower = _compare_dyadic(numerator, denominator, lower_m, lower_e)
			if lower < 0 or (lower == 0 and odd):
				high = bits - 1
				bits -= 1
				continue
		var upper = _compare_dyadic(
			numerator, denominator, significand * 2 + 1, binary_exponent - 1
		)
		if upper > 0 or (upper == 0 and odd):
			if bits == MAX_FINITE:
				return {"ok": false, "error": "JSON numbers must be finite."}
			low = bits + 1
			bits += 1
			continue
		return {"ok": true, "value": _from_bits(bits, negative)}
	return {"ok": false, "error": "JSON number could not be rounded safely."}
