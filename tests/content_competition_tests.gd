extends SceneTree
## Data-only rival styles, shared policy settings and exact frozen continuation.
var checks = 0
var failures: Array[String] = []
var geometry: TrackGeometry
class Store:
	extends WeekendEntryStore
	func save_record(record: RaceRecord) -> String:
		return RaceRecord.validate(record.seal())
func _initialize() -> void: call_deferred("run")
func check(value: bool, message: String) -> void:
	checks += 1
	if not value: failures.append(message); print("COMPETITION_FAILURE ", message)
func fresh(record: Dictionary = {}) -> PracticeRaceSim:
	var options = {"laps":12, "scenario":"dry", "seed":7314, "intensity":"calm", "rival_styles":true}
	if not record.is_empty(): options.tuning_definition = record
	var sim = PracticeRaceSim.new(geometry, options)
	sim.phase = "race"; sim.practice_state.status = "skipped"; sim.paused = false
	for car in sim.cars:
		car.distance = 600 + (12 - car.id) * 65; car.previous_distance = car.distance; car.speed = 40.0; car.fuel = 14.4
	return sim
func run() -> void:
	var loaded = ContentPackLoader.new().load_packs(["res://content/packs/core", "res://content/examples/club-racing"])
	check(loaded.ok, "Core and data-only proof pack validate")
	if not loaded.ok: print(JSON.stringify(loaded)); finish(); return
	var catalog: ContentCatalog = loaded.catalog
	var record = catalog.record("core.race_tuning.default")
	geometry = TrackGeometry.new(Storage.read_json("res://data/tracks/hillside.json").data)
	validation(record); baseline(record); consumers(record, catalog)
	finish()
func validation(record: Dictionary) -> void:
	var definition = RaceTuningDefinition.from_record(record)
	check(definition.competition == LegacyCompetition.VALUES, "Explicit defaults equal their pre-extraction values")
	check(definition.competition.is_read_only() and definition.competition.profiles.is_read_only() and definition.competition.profiles[0].weights.is_read_only(), "Nested tables and profile metadata are frozen")
	var old = record.duplicate(true); old.erase("competition")
	var compat = RaceTuningDefinition.from_record(old)
	check(compat != null and compat.to_record() == old and not compat.view().has("competition"), "Older content keeps its exact identity")
	check(compat.competition == LegacyCompetition.VALUES, "Omitted section uses immutable compatibility data")
	var count = 0
	for group in CompetitionTuningSchema.LIMITS:
		for key in CompetitionTuningSchema.LIMITS[group]:
			count += 1
			var limits = CompetitionTuningSchema.LIMITS[group][key]
			for value in [true, float(limits[0]) - 1, float(limits[1]) + 1]:
				var bad = record.duplicate(true); bad.competition[group][key] = value
				check(RaceTuningDefinition.from_record(bad) == null, "Reject invalid type/range: " + group + "/" + key)
	check(count == 84, "Every new numerical field has lower, upper and type coverage")
	for edit in [["prepare_distance_m",130], ["acquire_distance_m",200], ["assertive_preparation_seconds",2], ["balanced_preparation_seconds",2]]:
		var bad = record.duplicate(true); bad.competition.battle[edit[0]] = edit[1]
		check(RaceTuningDefinition.from_record(bad) == null, "Reject contradictory battle settings: " + edit[0])
	for mutation in ["duplicate", "reserved", "unknown", "weights", "empty"]:
		var bad = record.duplicate(true)
		match mutation:
			"duplicate": bad.competition.profiles[1].id = bad.competition.profiles[0].id
			"reserved": bad.competition.profiles[0].id = "legacy"
			"unknown": bad.competition.profiles[0].free_grip = 2.0
			"weights": bad.competition.profiles[0].weights[0] = 4.1
			"empty": bad.competition.profiles = []
		check(RaceTuningDefinition.from_record(bad) == null, "Reject invalid profile: " + mutation)
func baseline(record: Dictionary) -> void:
	var legacy = fresh(); var authored = fresh(record)
	for tick in range(2400):
		legacy.step(); authored.step()
		if tick in [0,599,1199,2399]:
			check(RaceRecord.equivalent(legacy.cars.map(func(c): return c.to_record()), authored.cars.map(func(c): return c.to_record())), "Default car trajectory matches legacy: " + str(tick))
			check(legacy.rng_state == authored.rng_state and legacy.weather_state == authored.weather_state, "Random streams and weather match: " + str(tick))
			check(legacy.battle_state == authored.battle_state and legacy.rival_styles == authored.rival_styles, "Default battle and rival decisions match: " + str(tick))
func consumers(record: Dictionary, catalog: ContentCatalog) -> void:
	var tuned = record.duplicate(true)
	tuned.competition.policy.review_seconds = 22.0; tuned.competition.policy.review_stagger_seconds = 0.5
	var sim = fresh(tuned); sim.total_time = 100.0
	sim.engineer(sim.cars[0]); sim.engineer(sim.cars[1])
	check(is_equal_approx(sim.policy(0).next_review,122.0), "Discretionary review uses authored interval")
	check(is_equal_approx(sim.policy(1).next_review,122.5), "Review staggering uses authored seconds")
	# The corridor fallback and persistent battle controller must share the same thresholds.
	var traffic = fresh(record); var follower = traffic.cars[0]; follower.battle_mode = "balanced"
	var old = traffic.cars.map(func(c): return {"speed":40.0, "lane":0.0, "distance":c.distance, "route":"track"})
	var sample = {"curvature":0.0, "w":12.0}; var local = {"water":0.0}
	check(traffic._base_traffic_instruction(follower,old,1,60.0,41.0,0.0,sample,local).attempt, "Default closing speed permits a physical probe")
	tuned = record.duplicate(true); tuned.competition.battle.balanced_speed_advantage_mps = 1.5
	traffic = fresh(tuned); follower = traffic.cars[0]; follower.battle_mode = "balanced"
	check(not traffic._base_traffic_instruction(follower,old,1,60.0,41.0,0.0,sample,local).attempt, "Authored closing speed reaches the real corridor fallback")
	var reference = fresh(record)
	tuned = record.duplicate(true); tuned.service.tyre_base_seconds = 8.0
	var service = fresh(tuned)
	check(is_equal_approx(TeamOrders.preview(service).first.service - TeamOrders.preview(reference).first.service,5.0), "Shared-box forecast uses physical service calibration")
	tuned = record.duplicate(true)
	var added = tuned.competition.profiles[0].duplicate(true)
	added.id = "local.test.rival.precise"; added.label = "Independent race planner"; added.summary = "External data-only profile."
	tuned.competition.profiles.push_front(added); sim = fresh(tuned)
	check(sim.rival_styles.drivers[0].style == added.id, "An arbitrary profile ID is assigned to the first rival team")
	var view = RaceViewQuery.new(sim)
	check(view.rival_profile_label(0) == added.label and view.rival_description(sim.rival_styles,view.car(0)).contains(added.label), "Native public readers accept arbitrary profile IDs")
	check(not view.public_rival_field().contains("\"weights\":") and not view.public_rival_field().contains("\"score\":"), "Public profiles do not reveal private scoring")
	var car = sim.cars[0]; var fitted = TyreInventory.find(car,car.set_id)
	for wheel in fitted.wheels.values(): wheel.life = 37.0; wheel.surface = 89.0; wheel.core = 89.0
	WheelTyres.publish(fitted); car.tyre = fitted.life; car.temperature = fitted.temperature
	var source = RaceForecaster.capture(sim,0); var original = RaceStateValue.fingerprint(sim.snapshot())
	var choice = RivalStyles.decide(source,[],sim.rival_styles.drivers[0],RaceForecaster.evaluate(source))
	check(not choice.is_empty() and choice.style == added.id, "Custom profile participates in real bounded candidate selection")
	check(original == RaceStateValue.fingerprint(sim.snapshot()), "Decision reads preserve state and randomness")
	var snapshot = JSON.parse_string(JSON.stringify(sim.snapshot(),"",true,true))
	var restored = PracticeRaceSim.restore_practice(snapshot)
	check(restored != null, "Custom profile and competition settings survive JSON restore")
	if restored != null:
		for tick in range(400): sim.step(); restored.step()
		check(RaceRecord.equivalent(sim.snapshot(),restored.snapshot()), "Frozen competition state resumes identically")
	var bad = snapshot.duplicate(true); bad.rival_styles.drivers[0].weights.offset += 0.1
	check(PracticeRaceSim.restore_practice(bad) == null, "A saved authored style cannot rewrite its frozen weights")
	var document = Storage.read_json("res://data/tracks/hillside.json").data; document.grid.count = 14
	var launch = WeekendLaunch.new(catalog)
	var weekend_id = "local.club.weekend.strategy_sprint"
	check(launch.stage_preset(weekend_id,document), "The data-only example weekend stages")
	if not launch.capture().is_empty():
		var committed = launch.commit(launch.capture().revision,Store.new())
		check(committed.ok, "Real launch/save accepts custom style: " + str(committed.get("error","")))
		if committed.ok:
			check(committed.simulation.rival_styles.drivers[0].style == "local.club.rival.patient", "Practice launch consumes the custom profile instead of legacy enums")
			committed.record.detach()
func finish() -> void:
	var result = {"passed":failures.is_empty(), "checks":checks, "failures":failures}
	Storage.write_json("res://reports/content-competition-tests.json",result)
	print("CONTENT_COMPETITION_TESTS ",JSON.stringify(result))
	quit(0 if failures.is_empty() else 1)
