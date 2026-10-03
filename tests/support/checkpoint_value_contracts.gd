extends RefCounted
## All public checkpoint readers reject nonserialized values before copying caller state.


static func run(geometry: TrackGeometry, check: Callable) -> void:
	var cycle: Array = []
	cycle.append(cycle)
	var oversized: Array = []
	oversized.resize(20001)
	oversized.fill(0)
	for profile in [
		{"name": "base", "model": RaceSim, "restore": RaceSim.restore},
		{"name": "strategy", "model": StrategyRaceSim, "restore": StrategyRaceSim.restore_weekend},
		{"name": "weather", "model": WeatherRaceSim, "restore": WeatherRaceSim.restore_weather},
		{"name": "recovery", "model": RecoveryRaceSim, "restore": RecoveryRaceSim.restore_recovery},
		{"name": "practice", "model": PracticeRaceSim, "restore": PracticeRaceSim.restore_practice}
	]:
		var model: RaceSim = profile.model.new(geometry)
		var baseline = model.snapshot()
		var before = RaceStateValue.fingerprint(baseline)
		check.call(profile.restore.call(baseline) != null, profile.name + " baseline restores")
		for extra in [RefCounted.new(), NAN, INF, cycle, oversized]:
			var invalid = baseline.duplicate(true)
			invalid.events[0]["extra"] = extra
			check.call(
				profile.restore.call(invalid) == null,
				profile.name + " rejects nonserialized nested event values"
			)
			check.call(
				(
					invalid.events.size() == baseline.events.size()
					and invalid.events[0].text == baseline.events[0].text
					and _same_extra(invalid.events[0].get("extra"), extra)
				),
				profile.name + " rejection preserves the caller event and invalid value"
			)
			check.call(
				RaceStateValue.fingerprint(model.snapshot()) == before,
				profile.name + " rejection preserves the existing model"
			)
			if profile.name == "base":
				check.call(
					not RaceCheckpoint.valid(invalid),
					"Checkpoint validation rejects nonserialized values"
				)
				check.call(
					RaceCheckpoint.prepare_base(invalid, RaceSim.CAR_V2, RaceSim.TYRES).is_empty(),
					"Legacy preparation rejects nonserialized values before copying"
				)
	cycle.clear()


static func _same_extra(current: Variant, original: Variant) -> bool:
	if original is float and is_nan(original):
		return current is float and is_nan(current)
	return is_same(current, original)
