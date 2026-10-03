class_name DeveloperTrackEdits
extends RefCounted
## JSON arguments for existing pure TrackEdit transformations.
const ACTIONS = [
	"transform",
	"arrange",
	"duplicate_scenery",
	"group",
	"ungroup",
	"move_positions",
	"move_handle",
	"move_reference"
]


static func point() -> Dictionary:
	return DeveloperFacetValues.object(
		{"x": ContentSchema.number(-100000, 100000), "y": ContentSchema.number(-100000, 100000)},
		["x", "y"]
	)


static func schema(action: String) -> Dictionary:
	var selected = ContentSchema.array(ContentSchema.integer(0, 1999), 2000, 1)
	var kind = {"enum": ["road", "scenery"]}
	match action:
		"transform":
			return DeveloperFacetValues.object(
				{
					"kind": kind,
					"selected": selected,
					"delta": point(),
					"degrees": ContentSchema.number(-360000, 360000),
					"factor": ContentSchema.number(0.000001, 100)
				},
				["selected"]
			)
		"arrange":
			return DeveloperFacetValues.object(
				{
					"kind": kind,
					"selected": selected,
					"axis": {"enum": ["x", "y"]},
					"distribute": {"type": "boolean"}
				},
				["selected", "axis"]
			)
		"duplicate_scenery", "group", "ungroup":
			return DeveloperFacetValues.object({"selected": selected}, ["selected"])
		"move_positions":
			var position = point()
			position.properties["index"] = ContentSchema.integer(0, 1999)
			position.required.append("index")
			return DeveloperFacetValues.object(
				{
					"kind": {"enum": ["road", "scenery", "pits"]},
					"positions": ContentSchema.array(position, 2000, 1)
				},
				["kind", "positions"]
			)
		"move_handle":
			return DeveloperFacetValues.object(
				{
					"index": ContentSchema.integer(0, 1999),
					"key": {"enum": ["in", "out"]},
					"position": point()
				},
				["index", "key", "position"]
			)
		"move_reference":
			return DeveloperFacetValues.object({"delta": point()}, ["delta"])
	return {}


static func describe() -> Array:
	var result: Array = []
	for action in ACTIONS:
		result.append({"action": action, "parameters": schema(action)})
	return result


static func apply(document: Dictionary, action: String, parameters: Dictionary) -> Dictionary:
	var selected: Array = parameters.get("selected", []).map(func(value): return int(value))
	match action:
		"transform":
			var delta = parameters.get("delta", {"x": 0, "y": 0})
			return TrackEdit.transform(
				document,
				parameters.get("kind", "road"),
				selected,
				Vector2(delta.x, delta.y),
				float(parameters.get("degrees", 0)),
				float(parameters.get("factor", 1))
			)
		"arrange":
			return TrackEdit.arrange(
				document,
				parameters.get("kind", "road"),
				selected,
				parameters.axis,
				parameters.get("distribute", false)
			)
		"duplicate_scenery":
			return TrackEdit.duplicate_scenery(document, selected)
		"group", "ungroup":
			return TrackEdit.group(document, selected, action == "ungroup")
		"move_positions":
			var positions = {}
			for item in parameters.positions:
				if positions.has(int(item.index)):
					return TrackEdit.failure("Move targets must be unique.")
				positions[int(item.index)] = Vector2(item.x, item.y)
			return TrackEdit.move_positions(document, parameters.kind, positions)
		"move_handle":
			return TrackEdit.move_handle(
				document,
				int(parameters.index),
				parameters.key,
				Vector2(parameters.position.x, parameters.position.y)
			)
		"move_reference":
			return TrackEdit.move_reference(
				document, Vector2(parameters.delta.x, parameters.delta.y)
			)
	return TrackEdit.failure("Unknown track edit.")
