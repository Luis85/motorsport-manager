class_name ContentCatalog
extends RefCounted
## Prepared catalog. Activation happens only after every selected pack validates.
var _records: Dictionary = {}
var _sources: Dictionary = {}
var _sealed: bool = false

func add(record: Dictionary, source: Dictionary, override_hash: String = "") -> Array:
	if _sealed:
		return [ContentValidation.diagnostic("CONTENT_SEALED", "", "A published catalog cannot be edited.")]
	var kind = str(record.get("kind", ""))
	if kind not in ContentSchema.KINDS:
		return [ContentValidation.diagnostic("CONTENT_KIND", "/kind", "Unsupported content kind: " + kind)]
	var errors = ContentValidation.check(record, ContentSchema.definition(kind))
	if not errors.is_empty(): return errors
	var id: String = record.id
	if _records.has(id):
		if override_hash.is_empty() or override_hash != RaceStateValue.fingerprint(_records[id]):
			return [ContentValidation.diagnostic("CONTENT_OVERRIDE", "/id", "Duplicate ID requires the exact prior definition hash.")]
		if _records[id].kind != kind:
			return [ContentValidation.diagnostic("CONTENT_KIND", "/kind", "An override cannot change the definition kind.")]
	elif not override_hash.is_empty():
		return [ContentValidation.diagnostic("CONTENT_OVERRIDE", "/id", "Override target is missing.")]
	var provenance = source.duplicate(true)
	provenance.previous = _sources.get(id, {}).duplicate(true)
	provenance.sha256 = RaceStateValue.fingerprint(record)
	_records[id] = RaceStateValue.read_only(record)
	_sources[id] = RaceStateValue.read_only(provenance)
	return []

func seal() -> Array:
	if _records.is_empty():
		return [ContentValidation.diagnostic("CONTENT_EMPTY", "", "The selected content set is empty.")]
	for id in _records:
		if _records[id].kind != "roster": continue
		var resolved = RosterDefinition.resolve(_records[id], _records)
		if not resolved.ok:
			for diagnostic in resolved.diagnostics:
				diagnostic.file = _sources[id].file
				diagnostic.root = _sources[id].root
				diagnostic.entity = id
			return resolved.diagnostics
	for id in _records:
		var entry: Dictionary = _records[id]
		if entry.kind == "tyre":
			var thermal = record(entry.thermal_profile_id)
			if thermal.get("kind") != "tyre_thermal":
				return _definition_error(id, "CONTENT_REFERENCE", "/thermal_profile_id", "Choose an existing tyre_thermal definition: " + str(entry.thermal_profile_id))
			if TyreDefinition.compile(entry, thermal) == null:
				return _definition_error(id, "CONTENT_TYRE_CURVE", "/surface_response", "Grip must remain between 0.05 and 2.0 throughout the supported water range; review the surface-response coefficients.")
		if entry.kind == "tyre_allocation" and tyres(id) == null:
			return _definition_error(id, "CONTENT_REFERENCE", "/sets", "Use unique existing compounds, at most 64 total sets, and selection references of the required family. See docs/content/tyres-and-setup.md.")
	for id in _records:
		if _records[id].kind == "setup" and SetupDefinition.from_record(_records[id]) == null:
			return _definition_error(id, "CONTENT_SETUP", "/controls", "Defaults/baselines must fit their control ranges and effect endpoints must remain physically positive. See docs/content/tyres-and-setup.md.")
	for id in _records:
		if _records[id].kind == "race_tuning" and _records[id].has("environment"):
			var problems = EnvironmentTuningSchema.semantic_errors(_records[id].environment)
			if not problems.is_empty():
				return _definition_error(id, problems[0].code, problems[0].field, problems[0].message)
		if _records[id].kind == "race_tuning" and _records[id].has("operations"):
			var problems = OperationsTuningSchema.semantic_errors(_records[id].operations)
			if not problems.is_empty():
				return _definition_error(id, problems[0].code, problems[0].field, problems[0].message)
		if _records[id].kind == "race_tuning" and tuning(id) == null:
			return _definition_error(id, "CONTENT_TUNING", "", "Use ordered mode multipliers and supported physical ranges.")
		if _records[id].kind == "weekend":
			for key in WeekendDefinition.REFERENCES:
				if record(_records[id][key]).get("kind") != WeekendDefinition.REFERENCES[key]:
					return _definition_error(id, "CONTENT_REFERENCE", "/" + key, "Choose an existing " + WeekendDefinition.REFERENCES[key] + " definition.")
	_sealed = true
	return []

func entries(kind: String) -> Array:
	var result: Array = []
	for id in _records:
		if _records[id].kind == kind: result.append(_records[id].duplicate(true))
	return result

func record(id: String) -> Dictionary:
	return _records.get(id, {}).duplicate(true)

func explain(id: String) -> Dictionary:
	return {"definition": record(id), "source": _sources.get(id, {}).duplicate(true)}

func vehicle(id: String) -> VehicleDefinition:
	var data = record(id)
	return VehicleDefinition.from_record(data) if not data.is_empty() else null

func roster(id: String) -> RosterDefinition:
	if not _sealed or not _records.has(id): return null
	var resolved = RosterDefinition.resolve(_records[id], _records)
	return RosterDefinition.decode_snapshot(resolved.snapshot) if resolved.ok else null

func tyres(id: String) -> RaceTyreRules:
	return RaceTyreRules.from_snapshot(tyre_snapshot(id))

func tyre_snapshot(id: String) -> Dictionary:
	var allocation = record(id)
	if allocation.get("kind") != "tyre_allocation": return {}
	var compounds: Array = []
	var profiles: Array = []
	var seen: Dictionary = {}
	for item in allocation.sets:
		var compound = record(item.compound_id)
		if compound.get("kind") != "tyre": return {}
		compounds.append(compound)
		var profile_id: String = compound.thermal_profile_id
		if seen.has(profile_id): continue
		seen[profile_id] = true
		var profile = record(profile_id)
		if profile.get("kind") != "tyre_thermal": return {}
		profiles.append(profile)
	return {"kind": "motorsport-manager-tyre-snapshot", "version": 1,
		"allocation": allocation, "compounds": compounds, "thermal_profiles": profiles}

func setup(id: String) -> SetupDefinition:
	return SetupDefinition.from_record(record(id))

func tuning(id: String) -> RaceTuningDefinition:
	return RaceTuningDefinition.from_record(record(id))

func weekend(id: String) -> WeekendDefinition:
	return WeekendDefinition.from_record(record(id))

func _definition_error(id: String, code: String, field: String, message: String) -> Array:
	var diagnostic = ContentValidation.diagnostic(code, field, message)
	var source: Dictionary = _sources.get(id, {})
	diagnostic.root = source.get("root", "")
	diagnostic.file = source.get("file", "")
	diagnostic.pack = source.get("pack", "")
	diagnostic.entity = id
	return [diagnostic]
