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
