class_name CircuitDefinition
extends RefCounted
## A content identity around the existing track authoring format, not another editor.
var _record: Dictionary = {}
var _document: Dictionary = {}
var id: String:
	get: return _record.id

static func fields() -> Dictionary:
	return {"document": {"type": "object"}}

static func from_record(record: Variant, style: Dictionary = {}) -> CircuitDefinition:
	if not record is Dictionary:
		return null
	if not ContentValidation.check(record, ContentSchema.definition("circuit")).is_empty():
		return null
	if not document_errors(record.document).is_empty():
		return null
	var document = TrackDocument.normalize(record.document)
	if not style.is_empty():
		if not ContentValidation.check(style, ContentSchema.definition("circuit_style")).is_empty():
			return null
		document.visual = style.visual.duplicate(true)
	if not TrackDocument.publication_errors(document).is_empty():
		return null
	if not document.id is String or document.id.is_empty() or document.id.length() > 100:
		return null
	var value = CircuitDefinition.new()
	value._record = RaceStateValue.read_only(record)
	value._document = RaceStateValue.read_only(document)
	return value

func document() -> Dictionary:
	return _document.duplicate(true)

func to_record() -> Dictionary:
	return _record.duplicate(true)

static func style_fields() -> Dictionary:
	return {"visual": ContentSchema.object({
		"environment": {"enum": ["meadow", "woodland", "coastal"]},
		"season": {"enum": ["summer", "autumn"]},
		"seed": ContentSchema.integer(0, 1000000)})}

static func document_errors(document: Variant) -> Array[String]:
	if not document is Dictionary or not RaceStateValue.serializable(document):
		return ["Track documents must contain bounded, finite serialized data."]
	if document.has("id") and (not document.id is String or document.id.is_empty() or document.id.length() > 100):
		return ["The circuit document ID must be a non-empty string of at most 100 characters."]
	var errors = TrackDocument.validate(document)
	if not errors.is_empty():
		return errors
	return TrackDocument.publication_errors(TrackDocument.normalize(document))
