class_name ContentJson
extends RefCounted
## Strict, bounded JSON for external content. No expressions, coercion or code loading.
const MAX_DEPTH = 24
const MAX_VALUES = 20000
var _text: String
var _position: int = 0
var _values: int = 0
var _error: String = ""
var _number = RegEx.new()

static func parse(text: String) -> Dictionary:
	var reader = ContentJson.new()
	reader._text = text
	reader._number.compile("-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?(?:[eE][+-]?[0-9]+)?")
	var value = reader._value(0)
	reader._space()
	if reader._error.is_empty() and reader._position != text.length():
		reader._error = "Unexpected text after JSON value."
	if not reader._error.is_empty():
		return {"ok": false, "error": reader._error,
			"line": text.left(reader._position).count("\n") + 1}
	return {"ok": true, "data": value}

func _space() -> void:
	while _position < _text.length() and _text[_position] in [" ", "\t", "\n", "\r"]:
		_position += 1

func _take(token: String) -> bool:
	_space()
	if _text.substr(_position, token.length()) != token:
		return false
	_position += token.length()
	return true

func _fail(message: String) -> Variant:
	if _error.is_empty():
		_error = message
	return null

func _value(depth: int) -> Variant:
	_values += 1
	if depth > MAX_DEPTH or _values > MAX_VALUES:
		return _fail("JSON exceeds the nesting or value-count limit.")
	_space()
	if _position >= _text.length():
		return _fail("Expected a JSON value.")
	match _text[_position]:
		"{": return _object(depth + 1)
		"[": return _array(depth + 1)
		"\"": return _string()
		"t":
			if _take("true"): return true
		"f":
			if _take("false"): return false
		"n":
			if _take("null"): return null
	var found = _number.search(_text, _position)
	if found == null or found.get_start() != _position:
		return _fail("Expected a JSON value; comments and trailing commas are not supported.")
	_position = found.get_end()
	var token = found.get_string()
	# Keep conversion away from engine overflow diagnostics, including hostile exponents.
	# Authorable values are much smaller; this is a parsing limit, not a game coefficient.
	if token.length() > 100:
		return _fail("JSON numeric token exceeds 100 characters.")
	var exponent = token.to_lower().split("e")
	if exponent.size() == 2 and (exponent[1].length() > 4 or absf(exponent[1].to_float()) > 100):
		return _fail("JSON exponent must be between -100 and 100.")
	var result = token.to_float()
	if not is_finite(result):
		return _fail("JSON numbers must be finite.")
	return result

func _object(depth: int) -> Variant:
	_position += 1
	var result: Dictionary = {}
	if _take("}"): return result
	while _error.is_empty():
		_space()
		if _position >= _text.length() or _text[_position] != "\"":
			return _fail("Expected a quoted object key.")
		var key = _string()
		if not _error.is_empty(): return null
		if result.has(key): return _fail("Duplicate object key: " + str(key))
		if not _take(":"): return _fail("Expected ':' after the object key.")
		result[key] = _value(depth)
		if not _error.is_empty(): return null
		if _take("}"): return result
		if not _take(","): return _fail("Expected ',' or '}' in the object.")
	return null

func _array(depth: int) -> Variant:
	_position += 1
	var result: Array = []
	if _take("]"): return result
	while _error.is_empty():
		result.append(_value(depth))
		if not _error.is_empty(): return null
		if _take("]"): return result
		if not _take(","): return _fail("Expected ',' or ']' in the array.")
	return null

func _hex_quad() -> int:
	var token = _text.substr(_position, 4)
	if token.length() != 4 or not token.is_valid_hex_number(false):
		_fail("Invalid Unicode escape.")
		return -1
	_position += 4
	return token.hex_to_int()

func _string() -> Variant:
	var start = _position
	_position += 1
	while _position < _text.length():
		var character = _text[_position]
		_position += 1
		if character == "\"":
			return JSON.parse_string(_text.substr(start, _position - start))
		if character.unicode_at(0) < 32:
			return _fail("Unescaped control character in string.")
		if character != "\\": continue
		if _position >= _text.length(): return _fail("Unfinished string escape.")
		var escape = _text[_position]
		_position += 1
		if escape in ["\"", "\\", "/", "b", "f", "n", "r", "t"]: continue
		if escape != "u": return _fail("Unsupported string escape.")
		var point = _hex_quad()
		if point < 0: return null
		if point >= 0xdc00 and point <= 0xdfff:
			return _fail("Unicode low surrogate has no high surrogate.")
		if point < 0xd800 or point > 0xdbff: continue
		if _text.substr(_position, 2) != "\\u":
			return _fail("Unicode high surrogate requires a low surrogate.")
		_position += 2
		point = _hex_quad()
		if point < 0xdc00 or point > 0xdfff:
			return _fail("Invalid Unicode surrogate pair.")
	return _fail("Unterminated string.")

static func valid_utf8(bytes: PackedByteArray) -> bool:
	## Check before Godot's decoder, which otherwise emits engine errors for bad bytes.
	var index = 0
	while index < bytes.size():
		var first = bytes[index]
		index += 1
		if first <= 0x7f: continue
		var count = 0
		var point = 0
		var minimum = 0
		if first >= 0xc2 and first <= 0xdf:
			count = 1; point = first & 0x1f; minimum = 0x80
		elif first >= 0xe0 and first <= 0xef:
			count = 2; point = first & 0x0f; minimum = 0x800
		elif first >= 0xf0 and first <= 0xf4:
			count = 3; point = first & 0x07; minimum = 0x10000
		else: return false
		if index + count > bytes.size(): return false
		for offset in range(count):
			var continuation = bytes[index]
			index += 1
			if continuation < 0x80 or continuation > 0xbf: return false
			point = (point << 6) | (continuation & 0x3f)
		if point < minimum or point > 0x10ffff or (point >= 0xd800 and point <= 0xdfff): return false
	return true
