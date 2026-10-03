extends RefCounted
## Saved careers reject malformed frozen payloads even when every digest is resealed.


static func run(checkpoint: Dictionary, check: Callable) -> void:
	var before = RaceStateValue.fingerprint(checkpoint)
	var restored = CampaignCheckpoint.restore(checkpoint)
	check.call(
		restored.ok and RaceStateValue.fingerprint(restored.checkpoint) == before,
		"Supported frozen campaign restores without rewriting content or resources"
	)
	for invalid in [null, true, 7, "scalar", [], {}]:
		_check_case(checkpoint, ["roster_definition", "roster"], invalid, "roster", check)
		_check_case(checkpoint, ["tyre_definition", "allocation"], invalid, "allocation", check)
		_check_creation(checkpoint.management.campaign_content, invalid, check)
	var options: Dictionary = checkpoint.management.campaign_content.race_options
	for fixture in _semantic_records(options):
		check.call(
			ContentValidation.check(fixture.record, fixture.schema).is_empty(),
			"Frozen semantic fixture satisfies structural schema: " + fixture.key
		)
		_check_case(checkpoint, [fixture.key], fixture.record, fixture.key, check)
	check.call(
		RaceStateValue.fingerprint(checkpoint) == before,
		"Frozen-content rejection matrix preserves original campaign authority"
	)


static func _check_creation(frozen: Dictionary, invalid: Variant, check: Callable) -> void:
	var initial = frozen.race_options.duplicate(true)
	initial.vehicle = frozen.vehicle
	initial.vehicle_definition = invalid
	initial.track = frozen.circuits[frozen.definition.calendar[0].circuit_id]
	var before = RaceStateValue.fingerprint(initial)
	check.call(
		CampaignContentSnapshot.build(frozen.definition, initial, frozen.circuits).is_empty(),
		"Campaign closure creation rejects an invalid vehicle payload"
	)
	check.call(
		RaceStateValue.fingerprint(initial) == before,
		"Rejected campaign closure creation preserves caller input"
	)


static func _check_case(
	checkpoint: Dictionary, path: Array, value: Variant, label: String, check: Callable
) -> void:
	var broken = checkpoint.duplicate(true)
	var parent: Dictionary = broken.management.campaign_content.race_options
	for index in range(path.size() - 1):
		parent = parent[path[index]]
	parent[path.back()] = value
	_seal(broken.management.campaign_content)
	_seal(broken.management)
	_seal(broken)
	var before = RaceStateValue.fingerprint(broken)
	check.call(
		not CampaignContentSnapshot.validate(broken.management.campaign_content).is_empty(),
		"Malformed frozen content rejects at its closure boundary: " + label
	)
	check.call(
		not CampaignCheckpoint.restore(broken).ok,
		"Resealed malformed frozen content cannot restore a campaign: " + label
	)
	check.call(
		RaceStateValue.fingerprint(broken) == before,
		"Rejected frozen content preserves caller evidence: " + label
	)


static func _semantic_records(options: Dictionary) -> Array:
	var roster = options.roster_definition.duplicate(true)
	roster.roster.entries[0].driver_id = "core.driver.missing"
	var tyres = options.tyre_definition.duplicate(true)
	tyres.allocation.selection.dry = tyres.allocation.selection.wet
	var setup = options.setup_definition.duplicate(true)
	setup.effects.corner_min = 2.0
	setup.effects.corner_max = 0.1
	var tuning = options.tuning_definition.duplicate(true)
	tuning.fuel.engine_rates.reverse()
	return [
		{"key": "roster_definition", "record": roster, "schema": ContentSchema.roster_snapshot()},
		{"key": "tyre_definition", "record": tyres, "schema": TyreSchema.snapshot()},
		{"key": "setup_definition", "record": setup, "schema": ContentSchema.definition("setup")},
		{
			"key": "tuning_definition",
			"record": tuning,
			"schema": ContentSchema.definition("race_tuning")
		}
	]


static func _seal(data: Dictionary) -> void:
	data.erase("digest")
	data.digest = RaceStateValue.fingerprint(data)
