class_name ContentVersions
extends RefCounted
## Version preflight is diagnostic only. Never rewrite a foreign or future format.
static func errors(record: Variant, manifest: bool = false) -> Array:
	var result: Array = []
	if not record is Dictionary:
		return result
	for field in (["schema_version", "runtime_contract"] if manifest else ["schema_version"]):
		var value = record.get(field)
		if typeof(value) not in [TYPE_INT, TYPE_FLOAT] or not is_finite(value) or value != floor(value):
			continue # The structural schema supplies the precise missing/type error.
		if value > ContentSchema.VERSION:
			result.append(ContentValidation.diagnostic("CONTENT_FUTURE_VERSION", "/" + field,
				"This file needs %s %.0f; the installed runtime supports %d. Upgrade to a compatible runtime; the source was not changed." % [field, value, ContentSchema.VERSION]))
		elif value < ContentSchema.VERSION:
			result.append(ContentValidation.diagnostic("CONTENT_MIGRATION_REQUIRED", "/" + field,
				"Unsupported %s %.0f. Folder packs start at version 1; no converter is registered for this format. Keep the original file and use an explicit supported migration, not a version-number edit." % [field, value]))
	return result
