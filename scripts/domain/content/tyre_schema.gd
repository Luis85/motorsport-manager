class_name TyreSchema
extends RefCounted
## Definitions of supported four-wheel content. No executable author expressions.
const MAX_COMPOUNDS = 24
const MAX_SETS = 64


static func fields(kind: String) -> Dictionary:
	match kind:
		"tyre_thermal":
			var parameters: Dictionary = {}
			for key in TyreThermalDefaults.BOUNDS:
				var bound = TyreThermalDefaults.BOUNDS[key]
				parameters[key] = ContentSchema.number(bound[0], bound[1])
			return {
				"model": {"enum": ["four-wheel-v1"]}, "parameters": ContentSchema.object(parameters)
			}
		"tyre":
			var response: Dictionary = {}
			for key in [
				"dry_floor",
				"dry_onset",
				"dry_loss",
				"inter_base",
				"inter_gain",
				"inter_peak",
				"inter_loss",
				"wet_base",
				"wet_gain"
			]:
				response[key] = ContentSchema.number(0, 2)
			return {
				"short": ContentSchema.text(8),
				"color": {"type": "string", "pattern": "^[0-9a-fA-F]{6}$"},
				"family": {"enum": ["slick", "intermediate", "wet"]},
				"grip": ContentSchema.number(0.1, 2),
				"wear": ContentSchema.number(0.01, 30),
				"optimum_c": ContentSchema.number(30, 130),
				"thermal_profile_id": ContentSchema.identity(),
				"surface_response": ContentSchema.object(response)
			}
		"tyre_allocation":
			var selection: Dictionary = {}
			for key in [
				"dry",
				"intermediate",
				"wet",
				"initial_dry",
				"initial_wet",
				"qualifying_dry",
				"qualifying_wet",
				"template_balanced",
				"template_extended"
			]:
				selection[key] = ContentSchema.identity()
			for key in ["intermediate_threshold", "wet_threshold", "qualifying_threshold"]:
				selection[key] = ContentSchema.number(0, 1)
			for key in ["qualifying", "practice", "race", "long_race"]:
				selection[key] = ContentSchema.array(ContentSchema.identity(), MAX_COMPOUNDS, 1)
			selection.long_stint_laps = ContentSchema.number(0, 100)
			return {
				"sets":
				ContentSchema.array(
					ContentSchema.object(
						{
							"compound_id": ContentSchema.identity(),
							"count": ContentSchema.integer(1, MAX_SETS)
						}
					),
					MAX_COMPOUNDS,
					1
				),
				"selection": ContentSchema.object(selection)
			}
	return {}


static func snapshot() -> Dictionary:
	return ContentSchema.object(
		{
			"kind": {"enum": ["motorsport-manager-tyre-snapshot"]},
			"version": {"enum": [1]},
			"allocation": ContentSchema.definition("tyre_allocation"),
			"compounds": ContentSchema.array(ContentSchema.definition("tyre"), MAX_COMPOUNDS, 1),
			"thermal_profiles":
			ContentSchema.array(ContentSchema.definition("tyre_thermal"), MAX_COMPOUNDS, 1)
		}
	)
