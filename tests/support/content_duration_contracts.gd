extends RefCounted
## Frozen presets retain the constructed qualifying limit, including its circuit floor.


static func run(check: Callable, catalog: ContentCatalog, document: Dictionary) -> void:
	for requested in [480.0, 120.0]:
		var launch = WeekendLaunch.new(catalog)
		var staged = launch.stage_preset(
			"local.club.weekend.sprint", document, {"qual_duration": requested}
		)
		check.call(staged, "Qualifying-duration fixture stages through production launch")
		if not staged:
			continue
		var sim = PracticeRaceSim.new(launch.visual_track(), launch.session_options())
		var baseline = sim.snapshot()
		check.call(
			(
				baseline.qual_duration
				== maxf(
					requested, sim.track.estimate * sim.tuning.sessions.qualifying_reference_laps
				)
			),
			"Qualifying duration follows the authored request and compiled circuit floor"
		)
		if requested == 120.0:
			check.call(
				baseline.qual_duration > requested,
				"Short-duration fixture actually exercises the circuit-dependent floor"
			)
		var restored = PracticeRaceSim.restore_practice(baseline)
		check.call(
			restored != null and restored.qual_duration == baseline.qual_duration,
			"Valid authored qualifying duration restores without the source catalog"
		)
		var json = JSON.stringify(baseline, "", true, true)
		for decoded in [JSON.parse_string(json), ContentJson.parse(json, true).data]:
			var roundtrip = PracticeRaceSim.restore_practice(decoded)
			check.call(
				roundtrip != null and roundtrip.qual_duration == baseline.qual_duration,
				"Qualifying duration survives native and production saved-number JSON decoding"
			)
		var changed = baseline.duplicate(true)
		changed.qual_duration += 30.0
		var before = RaceStateValue.fingerprint(changed)
		check.call(
			PracticeRaceSim.restore_practice(changed) == null,
			"Checkpoint rejects a qualifying limit inconsistent with its frozen preset"
		)
		check.call(
			RaceStateValue.fingerprint(changed) == before,
			"Qualifying-duration rejection leaves the caller checkpoint unchanged"
		)
		var record = RaceRecord.new()
		record.attach(sim)
		var sealed = record.seal()
		check.call(
			RaceRecord.validate(sealed).is_empty(), "Untampered duration recording validates"
		)
		for key in ["initial", "endpoint"]:
			sealed[key].qual_duration += 30.0
		sealed.erase("digest")
		sealed["digest"] = RaceRecord.fingerprint(sealed)
		check.call(
			not RaceRecord.validate(sealed).is_empty(),
			"Rehashing both recording checkpoints cannot override the frozen qualifying limit"
		)
		record.detach()
