class_name ContentCatalog
extends RefCounted
## Prepared catalog. Activation happens only after every selected pack validates.
var _records: Dictionary = {}
var _sources: Dictionary = {}
var _sealed: bool = false


func add(record: Dictionary, source: Dictionary, override_hash: String = "") -> Array:
	if _sealed:
		return [
			ContentValidation.diagnostic(
				"CONTENT_SEALED", "", "A published catalog cannot be edited."
			)
		]
	var kind = str(record.get("kind", ""))
	if kind not in ContentSchema.KINDS:
		return [
			ContentValidation.diagnostic(
				"CONTENT_KIND", "/kind", "Unsupported content kind: " + kind
			)
		]
	var errors = ContentVersions.errors(record)
	if not errors.is_empty():
		return errors
	errors = ContentValidation.check(record, ContentSchema.definition(kind))
	if not errors.is_empty():
		return errors
	var id: String = record.id
	errors = _override_errors(record, kind, override_hash)
	if not errors.is_empty():
		return errors
	var provenance = source.duplicate(true)
	provenance.previous = _sources.get(id, {}).duplicate(true)
	provenance.sha256 = RaceStateValue.fingerprint(record)
	_records[id] = RaceStateValue.read_only(record)
	_sources[id] = RaceStateValue.read_only(provenance)
	return []


func seal() -> Array:
	var errors = ContentCatalogValidation.new(self, _records, _sources).validate()
	if errors.is_empty():
		_sealed = true
	return errors


func entries(kind: String) -> Array:
	var result: Array = []
	for id in _records:
		if _records[id].kind == kind:
			result.append(_records[id].duplicate(true))
	return result


func record(id: String) -> Dictionary:
	return _records.get(id, {}).duplicate(true)


func explain(id: String) -> Dictionary:
	return {"definition": record(id), "source": _sources.get(id, {}).duplicate(true)}


func vehicle(id: String) -> VehicleDefinition:
	var data = record(id)
	return VehicleDefinition.from_record(data) if not data.is_empty() else null


func roster(id: String) -> RosterDefinition:
	if not _sealed or not _records.has(id):
		return null
	var resolved = RosterDefinition.resolve(_records[id], _records)
	return RosterDefinition.decode_snapshot(resolved.snapshot) if resolved.ok else null


func tyres(id: String) -> RaceTyreRules:
	return RaceTyreRules.from_snapshot(tyre_snapshot(id))


func tyre_snapshot(id: String) -> Dictionary:
	var allocation = record(id)
	if allocation.get("kind") != "tyre_allocation":
		return {}
	var compounds: Array = []
	var profiles: Array = []
	var seen: Dictionary = {}
	for item in allocation.sets:
		var compound = record(item.compound_id)
		if compound.get("kind") != "tyre":
			return {}
		compounds.append(compound)
		var profile_id: String = compound.thermal_profile_id
		if seen.has(profile_id):
			continue
		seen[profile_id] = true
		var profile = record(profile_id)
		if profile.get("kind") != "tyre_thermal":
			return {}
		profiles.append(profile)
	return {
		"kind": "motorsport-manager-tyre-snapshot",
		"version": 1,
		"allocation": allocation,
		"compounds": compounds,
		"thermal_profiles": profiles
	}


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


func circuit(id: String) -> CircuitDefinition:
	var entry = record(id)
	if entry.is_empty():
		return null
	return CircuitDefinition.from_record(
		entry, record(entry.style_id) if entry.has("style_id") else {}
	)


func scenario(id: String) -> ContentScenarioDefinition:
	return ContentScenarioDefinition.from_record(record(id))


func circuit_documents() -> Array:
	var result: Array = []
	for entry in entries("circuit"):
		var definition = circuit(entry.id)
		if definition != null:
			var document = definition.document()
			document.builtin = true
			result.append(document)
	return result


func mechanic_profile(id: String) -> MechanicProfileDefinition:
	return MechanicProfileDefinition.from_record(record(id))


func campaign(id: String) -> CampaignDefinition:
	return CampaignDefinition.from_record(record(id))


func default_campaign() -> CampaignDefinition:
	for entry in entries("campaign"):
		if entry.get("default", false):
			return campaign(entry.id)
	return null


func editor_profile(id: String) -> EditorProfileDefinition:
	return EditorProfileDefinition.from_record(record(id))


func _override_errors(record: Dictionary, kind: String, override_hash: String) -> Array:
	var id: String = record.id
	if _records.has(id):
		if override_hash.is_empty() or override_hash != RaceStateValue.fingerprint(_records[id]):
			return [
				ContentValidation.diagnostic(
					"CONTENT_OVERRIDE",
					"/id",
					"Duplicate ID requires the exact prior definition hash."
				)
			]
		if _records[id].kind != kind:
			return [
				ContentValidation.diagnostic(
					"CONTENT_KIND", "/kind", "An override cannot change the definition kind."
				)
			]
	elif not override_hash.is_empty():
		return [
			ContentValidation.diagnostic("CONTENT_OVERRIDE", "/id", "Override target is missing.")
		]
	return []
