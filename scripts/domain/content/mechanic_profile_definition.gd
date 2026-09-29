class_name MechanicProfileDefinition
extends RefCounted
## A frozen family of construction-time plans for the existing save-reader profiles.
## Content selects registered providers; it cannot load scripts or invent save readers.
var _record: Dictionary = {}
var id: String:
	get: return _record.id

static func fields() -> Dictionary:
	var identity = ContentSchema.text(96)
	identity.pattern = "^[a-z][a-z0-9_]*$"
	var provider = ContentSchema.object({"id": identity, "version": ContentSchema.integer(1, 100000)})
	var profiles: Dictionary = {}
	for context in RaceMechanicProfiles.ORDER:
		profiles[context] = ContentSchema.array(provider, 32, 1)
	return {"profiles": ContentSchema.object(profiles)}

static func from_record(record: Variant) -> MechanicProfileDefinition:
	if not record is Dictionary:
		return null
	if not ContentValidation.check(record, ContentSchema.definition("mechanic_profile")).is_empty():
		return null
	if not errors(record).is_empty():
		return null
	var value = MechanicProfileDefinition.new()
	value._record = RaceStateValue.read_only(record)
	return value

static func errors(record: Dictionary) -> Array[String]:
	var result: Array[String] = []
	for context in RaceMechanicProfiles.ORDER:
		var selected: Array = record.profiles[context]
		var required = RaceMechanicProfiles.ORDER.slice(0, RaceMechanicProfiles.ORDER.find(context) + 1)
		var definitions: Array = []
		for index in range(selected.size()):
			var entry: Dictionary = selected[index]
			var provider = RaceMechanicProfiles.registered(entry.id)
			if provider == null:
				result.append("Unregistered provider in %s: %s" % [context, entry.id])
				continue
			var definition = provider.definition()
			if entry.version != definition.version:
				result.append("Provider version is not installed in %s: %s" % [context, entry.id])
			if index < required.size() and entry.id != required[index]:
				result.append("Preserve the required %s save-reader prefix: %s" % [context, str(required)])
			elif index >= required.size() and entry.id in RaceMechanicProfiles.ORDER:
				result.append("A later compatibility provider cannot be installed into " + context)
			definitions.append(definition)
		if selected.size() < required.size():
			result.append("Missing required providers for the " + context + " save reader.")
		result.append_array(RaceMechanics.validate(definitions))
	return result

func to_record() -> Dictionary:
	return _record.duplicate(true)

func providers(context: String) -> Array[RaceMechanic]:
	var result: Array[RaceMechanic] = []
	if not _record.profiles.has(context):
		return result
	for entry in _record.profiles[context]:
		result.append(RaceMechanicProfiles.registered(entry.id))
	return result
