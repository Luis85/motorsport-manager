class_name ContentSchema
extends RefCounted
## Executable schema contract. Published JSON Schemas are generated from this source.
## Adding a new behavior/field is an engine change; adding an instance is content.
const VERSION = 1
const KINDS: Array[String] = ["vehicle", "team", "driver", "roster"]
const MAX_ENTRANTS = 24
const ID_PATTERN = "^[a-z][a-z0-9_-]*(?:\\.[a-z0-9_-]+)+$"

static func text(limit: int = 160, minimum: int = 1) -> Dictionary:
	return {"type": "string", "minLength": minimum, "maxLength": limit}

static func identity() -> Dictionary:
	var result = text(96)
	result.pattern = ID_PATTERN
	return result

static func number(low: float, high: float) -> Dictionary:
	return {"type": "number", "minimum": low, "maximum": high}

static func integer(low: int, high: int) -> Dictionary:
	return {"type": "integer", "minimum": low, "maximum": high}

static func object(properties: Dictionary, required: Array = []) -> Dictionary:
	return {"type": "object", "properties": properties,
		"required": properties.keys() if required.is_empty() else required,
		"additionalProperties": false}

static func array(items: Dictionary, maximum: int, minimum: int = 0) -> Dictionary:
	return {"type": "array", "items": items, "minItems": minimum, "maxItems": maximum}

static func manifest() -> Dictionary:
	var pack_id = text(96)
	pack_id.pattern = "^[a-z][a-z0-9_-]*(?:\\.[a-z0-9_-]+)*$"
	var checksum = text(64, 64)
	checksum.pattern = "^[0-9a-f]{64}$"
	return object({
		"kind": {"enum": ["motorsport-manager-content-pack"]},
		"schema_version": {"enum": [VERSION]},
		"id": pack_id, "version": text(40),
		"runtime_contract": {"enum": [VERSION]},
		"dependencies": array(object({"id": pack_id, "version": text(40)}), 32),
		"files": array(text(200), 2048),
		"overrides": array(object({"id": identity(), "expected_sha256": checksum}), 2048)})

static func definition(kind: String) -> Dictionary:
	var properties = {"kind": {"enum": [kind]}, "schema_version": {"enum": [VERSION]},
		"id": identity(), "name": text(), "description": text(2048, 0)}
	match kind:
		"vehicle":
			properties.merge({"top_speed_mps": number(1, 150),
				"lateral_acceleration_mps2": number(1, 60),
				"acceleration_mps2": number(0.1, 30), "braking_mps2": number(0.1, 40),
				"width_m": number(0.5, 4)})
		"team":
			properties.merge({"color": {"type": "string", "pattern": "^[0-9a-fA-F]{6}$"}})
		"driver":
			properties.merge({"short": text(8), "skill": integer(0, 100),
				"consistency": integer(0, 100), "wet_skill": integer(0, 100),
				"reliability": integer(0, 100)})
		"roster":
			properties.merge({"player_team_id": identity(),
				"entries": array(object({"driver_id": identity(), "team_id": identity(),
					"number": integer(1, 999), "color": {"type": "string", "pattern": "^[0-9a-fA-F]{6}$"}}), MAX_ENTRANTS, 2),
				"pit_boxes": array(object({"team_id": identity(), "fraction": number(0.1, 0.9)}), MAX_ENTRANTS, 1)})
		_: return {}
	return object(properties)

static func document(kind: String) -> Dictionary:
	var result = manifest() if kind == "pack" else definition(kind)
	if not result.is_empty():
		result["$schema"] = "https://json-schema.org/draft/2020-12/schema"
		result["title"] = "Motorsport Manager " + kind + " v1"
	return result

static func roster_snapshot() -> Dictionary:
	return object({"kind": {"enum": ["motorsport-manager-roster-snapshot"]},
		"version": {"enum": [1]}, "roster": definition("roster"),
		"drivers": array(definition("driver"), MAX_ENTRANTS, 2),
		"teams": array(definition("team"), MAX_ENTRANTS, 1)})
