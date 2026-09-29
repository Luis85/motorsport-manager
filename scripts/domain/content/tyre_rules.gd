class_name RaceTyreRules
extends RefCounted
## Frozen allocation and its complete transitive compound/thermal definitions.
var _snapshot: Dictionary = {}
var _specs: Dictionary = {}
var _sets: Array = []
var _selection: Dictionary = {}
static var _legacy: RaceTyreRules

static func legacy() -> RaceTyreRules:
	if _legacy != null: return _legacy
	var result = RaceTyreRules.new()
	result._specs = LegacyTyreContent.PROFILES.duplicate(true)
	for key in result._specs:
		result._specs[key].thermal = TyreThermalDefaults.PARAMETERS
		result._specs[key].operating = TyreOperatingSchema.LEGACY
	for key in LegacyTyreContent.ALLOCATION:
		result._sets.append({"compound_id": key, "count": LegacyTyreContent.ALLOCATION[key]})
	result._selection = LegacyTyreContent.SELECTION
	result._specs = RaceStateValue.read_only(result._specs)
	result._sets = RaceStateValue.read_only(result._sets)
	_legacy = result
	return result

static func from_snapshot(value: Variant) -> RaceTyreRules:
	if not ContentValidation.check(value, TyreSchema.snapshot()).is_empty(): return null
	var result = RaceTyreRules.new()
	var compounds: Dictionary = {}
	var thermals: Dictionary = {}
	for item in value.thermal_profiles:
		if thermals.has(item.id): return null
		thermals[item.id] = item
	for item in value.compounds:
		if compounds.has(item.id) or not thermals.has(item.thermal_profile_id): return null
		compounds[item.id] = item
		var compiled = TyreDefinition.compile(item, thermals[item.thermal_profile_id])
		if compiled == null: return null
		result._specs[item.id] = compiled.parameters()
	var used_profiles: Dictionary = {}
	var count = 0
	var used: Dictionary = {}
	for item in value.allocation.sets:
		if not compounds.has(item.compound_id) or used.has(item.compound_id): return null
		used[item.compound_id] = true
		used_profiles[compounds[item.compound_id].thermal_profile_id] = true
		count += int(item.count)
	if count > TyreSchema.MAX_SETS or used.size() != compounds.size() or used_profiles.size() != thermals.size(): return null
	var selection = value.allocation.selection
	for key in ["dry", "intermediate", "wet", "initial_dry", "initial_wet", "qualifying_dry", "qualifying_wet", "template_balanced", "template_extended"]:
		if not used.has(selection[key]): return null
	for key in ["qualifying", "practice", "race", "long_race"]:
		var seen: Dictionary = {}
		for id in selection[key]:
			if not used.has(id) or seen.has(id) or compounds[id].family != "slick": return null
			seen[id] = true
	if compounds[selection.dry].family != "slick" or compounds[selection.intermediate].family != "intermediate" or compounds[selection.wet].family != "wet": return null
	if compounds[selection.initial_dry].family != "slick" or compounds[selection.initial_wet].family == "slick": return null
	if compounds[selection.qualifying_dry].family != "slick" or compounds[selection.qualifying_wet].family == "slick": return null
	if selection.intermediate_threshold >= selection.wet_threshold: return null
	result._snapshot = RaceStateValue.read_only(value)
	result._specs = RaceStateValue.read_only(result._specs)
	result._sets = result._snapshot.allocation.sets
	result._selection = result._snapshot.allocation.selection
	return result

func to_snapshot() -> Dictionary:
	return _snapshot.duplicate(true)

func authored() -> bool:
	return not _snapshot.is_empty()

func spec(id: String) -> Dictionary:
	return _specs.get(id, {})

func compounds() -> Array:
	return _specs.keys()

func wet(id: String) -> bool:
	return spec(id).get("family", "slick") != "slick"

func recommended(water: float) -> String:
	return recommendation(_selection, water)

static func recommendation(selection: Dictionary, water: float) -> String:
	return selection.wet if water > selection.wet_threshold else (selection.intermediate if water > selection.intermediate_threshold else selection.dry)

func initial(scenario: String) -> String:
	return _selection.initial_wet if scenario == "wet" else _selection.initial_dry

func qualifying_start(water: float) -> String:
	return _selection.qualifying_wet if water > _selection.qualifying_threshold else _selection.qualifying_dry

func preferences(phase: String, water: float, remaining_laps: float) -> Array:
	var wanted = recommended(water)
	if wanted == _selection.dry:
		if phase == "qualifying": return _selection.qualifying
		if phase == "practice": return _selection.practice
		return _selection.long_race if remaining_laps > _selection.long_stint_laps else _selection.race
	return [wanted, _selection.intermediate if wanted == _selection.wet else _selection.wet]

func inventory_entries(owner: int) -> Array:
	var result: Array = []
	for allocation in _sets:
		var compound: String = allocation.compound_id
		for index in range(int(allocation.count)):
			var label: String = str(spec(compound).short) + str(index + 1)
			var identity = str(owner) + "-" + (compound + "-" + str(index + 1) if authored() else label)
			result.append({"id": identity, "label": label, "compound": compound})
	return result

func view() -> Dictionary:
	return {"compounds": _specs.duplicate(true), "selection": _selection.duplicate(true)}

func strategy_compound(template: String) -> String:
	return _selection.template_balanced if template == "balanced" else _selection.template_extended

func practice_start(water: float) -> String:
	return _selection.intermediate if water > _selection.intermediate_threshold else _selection.dry
