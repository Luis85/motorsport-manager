extends RefCounted
## Schema rejection stays bounded and cannot publish a partial catalog edit.


static func run(check: Callable, loaded_catalog: ContentCatalog) -> void:
	var definition = loaded_catalog.record("core.vehicle.gt")
	var candidate = ContentCatalog.new()
	check.call(
		(
			candidate
			. add(definition, {"root": "test", "file": "vehicle.json", "pack": "test"})
			. is_empty()
		),
		"Diagnostic-budget fixture admits its original vehicle"
	)
	var original = candidate.explain(definition.id)
	var changed = definition.duplicate(true)
	for index in range(ContentValidation.MAX_DIAGNOSTICS * 2):
		changed["unexpected_%d" % index] = index
	var before = RaceStateValue.fingerprint(changed)
	var errors = ContentValidation.check(changed, ContentSchema.definition("vehicle"))
	check.call(
		errors.size() == ContentValidation.MAX_DIAGNOSTICS,
		"Unknown-field rejection respects the diagnostic budget"
	)
	check.call(
		(
			errors[0].field == "/unexpected_0"
			and errors.back().field == "/unexpected_%d" % (ContentValidation.MAX_DIAGNOSTICS - 1)
		),
		"Bounded diagnostics retain the original validation order"
	)
	check.call(
		(
			candidate.add(changed, {}).size() == ContentValidation.MAX_DIAGNOSTICS
			and candidate.explain(definition.id) == original
		),
		"Bounded rejection preserves the catalog definition and provenance"
	)
	check.call(
		RaceStateValue.fingerprint(changed) == before,
		"Bounded rejection preserves the caller's invalid definition"
	)
	check.call(candidate.seal().is_empty(), "A rejected definition leaves the catalog sealable")
	var missing = loaded_catalog.record("core.race_tuning.default")
	for key in missing:
		if missing[key] is Dictionary:
			missing[key] = {}
	errors = ContentValidation.check(missing, ContentSchema.definition("race_tuning"))
	check.call(
		errors.size() == ContentValidation.MAX_DIAGNOSTICS,
		"Nested required-field rejection respects the same diagnostic budget"
	)
