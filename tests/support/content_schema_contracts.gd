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
	_missing_roster_context(check, loaded_catalog)


static func _missing_roster_context(check: Callable, loaded_catalog: ContentCatalog) -> void:
	var candidate = ContentCatalog.new()
	var roster = loaded_catalog.record("core.roster.default")
	check.call(
		candidate.add(roster, {}).is_empty(), "A roster can be staged without file provenance"
	)
	var errors = candidate.seal()
	check.call(
		(
			not errors.is_empty()
			and errors[0].code == "CONTENT_REFERENCE_MISSING"
			and errors[0].file == ""
			and errors[0].root == ""
			and errors[0].entity == roster.id
		),
		"Missing roster dependencies report diagnostics when file provenance is unavailable"
	)
	check.call(
		candidate.record(roster.id) == roster, "Failed closure validation preserves the roster"
	)
	var repaired = true
	for kind in ["team", "driver"]:
		for definition in loaded_catalog.entries(kind):
			repaired = candidate.add(definition, {}).is_empty() and repaired
	check.call(repaired, "Failed closure validation leaves the candidate editable for retry")
	check.call(
		candidate.seal().is_empty() and candidate.roster(roster.id) != null,
		"Restoring the roster dependencies publishes a complete usable catalog"
	)
