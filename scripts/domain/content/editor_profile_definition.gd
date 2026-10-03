class_name EditorProfileDefinition
extends RefCounted
## Authoring-only Circuit Atelier presentation data. No executable callbacks or gameplay rules.
const DEFAULT_ID = "core.editor_profile.default"
const OBJECT_TYPES: Array[String] = [
	"tree", "grandstand", "garage", "tower", "yacht", "water", "tent", "cafe"
]
const GUIDE_KEYS: Array[String] = ["shape", "scenery", "trace", "checks", "handoff"]
var _record: Dictionary = {}


static func fields() -> Dictionary:
	var local_id = ContentSchema.text(32)
	local_id.pattern = "^[a-z][a-z0-9_-]*$"
	var placement = (
		ContentSchema
		. object(
			{
				"id": local_id,
				"name": ContentSchema.text(60),
				"object_type": {"enum": OBJECT_TYPES},
				"scale": ContentSchema.number(0.2, 8.0),
				"rotation_deg": ContentSchema.number(-360.0, 360.0),
			}
		)
	)
	var guide = (
		ContentSchema
		. object(
			{
				"key": {"enum": GUIDE_KEYS},
				"title": ContentSchema.text(80),
				"body": ContentSchema.text(800),
			}
		)
	)
	return {
		"placements": ContentSchema.array(placement, 32, 1),
		"placement_help": ContentSchema.text(500),
		"guide": ContentSchema.array(guide, GUIDE_KEYS.size(), GUIDE_KEYS.size())
	}


static func from_record(record: Variant) -> EditorProfileDefinition:
	if not record is Dictionary:
		return null
	if not ContentValidation.check(record, ContentSchema.definition("editor_profile")).is_empty():
		return null
	if record.id != DEFAULT_ID:
		return null
	var placements: Dictionary = {}
	for preset in record.placements:
		if placements.has(preset.id):
			return null
		placements[preset.id] = true
	var guide: Dictionary = {}
	for step in record.guide:
		if guide.has(step.key):
			return null
		guide[step.key] = true
	for key in GUIDE_KEYS:
		if not guide.has(key):
			return null
	var result = EditorProfileDefinition.new()
	result._record = RaceStateValue.read_only(record)
	return result


func to_record() -> Dictionary:
	return _record.duplicate(true)


func placements() -> Array:
	return _record.placements.duplicate(true)


func guide_steps() -> Array:
	return _record.guide.duplicate(true)


static func placement_object(preset: Dictionary, position: Vector2) -> Dictionary:
	if not preset.get("object_type") in OBJECT_TYPES:
		return {}
	if not TrackDocument.valid_number(preset.get("scale"), 0.2, 8.0):
		return {}
	if not TrackDocument.valid_number(preset.get("rotation_deg"), -360.0, 360.0):
		return {}
	return {
		"type": preset.object_type,
		"x": position.x,
		"y": position.y,
		"h": 0,
		"scale": float(preset.scale),
		"rotation": float(preset.rotation_deg)
	}
