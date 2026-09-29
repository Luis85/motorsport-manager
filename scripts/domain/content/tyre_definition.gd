class_name TyreDefinition
extends RefCounted
## Compiled immutable compound; all physics and forecasts receive this same input.
var _data: Dictionary = {}

static func compile(record: Dictionary, thermal: Dictionary) -> TyreDefinition:
	if not ContentValidation.check(record, ContentSchema.definition("tyre")).is_empty(): return null
	if not ContentValidation.check(thermal, ContentSchema.definition("tyre_thermal")).is_empty(): return null
	if thermal.has("operating") and not TyreOperatingSchema.valid(thermal.operating): return null
	if record.thermal_profile_id != thermal.id: return null
	var r: Dictionary = record.surface_response
	var spec = {"family": record.family, "response": r}
	for water in [0.0, 1.0, clampf(r.dry_onset, 0, 1), clampf(r.inter_peak, 0, 1)]:
		var grip = TyreSurfaceResponse.factor(spec, water)
		if grip < 0.05 or grip > 2.0: return null
	var result = TyreDefinition.new()
	result._data = RaceStateValue.read_only({"id": record.id, "short": record.short,
		"name": record.name, "color": record.color, "family": record.family,
		"grip": float(record.grip), "wear": float(record.wear), "optimum": float(record.optimum_c),
		"response": record.surface_response, "thermal": thermal.parameters,
		"operating": thermal.get("operating", TyreOperatingSchema.LEGACY)})
	return result

func parameters() -> Dictionary:
	return _data

var grip: float:
	get: return float(_data.grip)
var wear: float:
	get: return float(_data.wear)
var optimum_c: float:
	get: return float(_data.optimum)
var family: String:
	get: return str(_data.family)
