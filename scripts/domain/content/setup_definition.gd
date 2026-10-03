class_name SetupDefinition
extends RefCounted
static var _legacy: SetupDefinition
## Frozen supported controls, named baselines and coefficients. Not executable formulas.
var _record: Dictionary = {}
var _specs: Dictionary = {}
var _defaults: Dictionary = {}


static func legacy() -> SetupDefinition:
	if _legacy != null:
		return _legacy
	var result = SetupDefinition.new()
	result._specs = LegacySetupContent.SPECS
	result._defaults = LegacySetupContent.DEFAULTS
	_legacy = result
	return result


static func from_record(record: Variant) -> SetupDefinition:
	if not ContentValidation.check(record, ContentSchema.definition("setup")).is_empty():
		return null
	var result = SetupDefinition.new()
	for key in record.controls:
		var control: Dictionary = record.controls[key]
		if (
			control.minimum > control.maximum
			or control.default < control.minimum
			or control.default > control.maximum
		):
			return null
		result._specs[key] = [
			int(control.minimum), int(control.maximum), control.label, control.description
		]
		result._defaults[key] = int(control.default)
	for baseline in record.baselines:
		if not result.valid_values(record.baselines[baseline]):
			return null
	var e: Dictionary = record.effects
	if e.corner_min > e.corner_max or e.traction_min > e.traction_max:
		return null
	# This supported model is linear in wing/cooling. Endpoint checks cover every
	# reachable control combination without interpreting author-written formulas.
	for wing in [record.controls.wing.minimum, record.controls.wing.maximum]:
		for cooling in [record.controls.cooling.minimum, record.controls.cooling.maximum]:
			var straight = (
				1
				- (wing - e.wing_centre) * e.wing_drag_loss
				- (cooling - e.cooling_centre) * e.cooling_drag_loss
			)
			if straight < 0.1 or straight > 2.0:
				return null
	result._record = RaceStateValue.read_only(record)
	result._defaults = RaceStateValue.read_only(result._defaults)
	result._specs = RaceStateValue.read_only(result._specs)
	return result


static func fields() -> Dictionary:
	var controls: Dictionary = {}
	var values: Dictionary = {}
	for key in LegacySetupContent.SPECS:
		var bound = LegacySetupContent.SPECS[key]
		values[key] = ContentSchema.integer(bound[0], bound[1])
		controls[key] = ContentSchema.object(
			{
				"minimum": values[key],
				"maximum": values[key],
				"default": values[key],
				"label": ContentSchema.text(80),
				"description": ContentSchema.text(400, 0)
			}
		)
	var coefficients: Dictionary = {}
	for key in LegacySetupContent.EFFECTS:
		coefficients[key] = ContentSchema.number(0, maxf(1, LegacySetupContent.EFFECTS[key] * 4))
	for key in ["corner_min", "corner_max", "traction_min", "traction_max", "brake_min"]:
		coefficients[key] = ContentSchema.number(0.1, 2)
	coefficients.brake_min = ContentSchema.number(0.1, 1)
	var baselines: Dictionary = {}
	for key in LegacySetupContent.BASELINES:
		baselines[key] = ContentSchema.object(values)
	return {
		"model": {"enum": ["five-control-v1"]},
		"controls": ContentSchema.object(controls),
		"effects": ContentSchema.object(coefficients),
		"baselines": ContentSchema.object(baselines),
		"initial_temperatures":
		ContentSchema.object(
			{"engine_c": ContentSchema.number(0, 200), "brake_c": ContentSchema.number(0, 1500)}
		)
	}


func authored() -> bool:
	return not _record.is_empty()


func to_record() -> Dictionary:
	return _record.duplicate(true)


func specs() -> Dictionary:
	return _specs


func defaults() -> Dictionary:
	return _defaults


func effects() -> Dictionary:
	return _record.effects if authored() else LegacySetupContent.EFFECTS


func initial_temperatures() -> Dictionary:
	return _record.initial_temperatures if authored() else LegacySetupContent.INITIAL


func baseline(name: String) -> Dictionary:
	return (
		(_record.baselines if authored() else LegacySetupContent.BASELINES)
		. get(name, {})
		. duplicate(true)
	)


func valid_values(values: Variant) -> bool:
	if not values is Dictionary or values.size() != _specs.size():
		return false
	for key in _specs:
		if not RaceCheckpoint.integral(values.get(key), _specs[key][0], _specs[key][1]):
			return false
	return true
