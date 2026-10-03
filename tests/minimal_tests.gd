extends "res://tests/support/minimal_control_contracts.gd"


func test_readouts_and_timing() -> void:
	# Synthetic read-model edge fixtures. No physics or classification injection
	# in the separate full weekend journey.
	var sim = fixture()
	sim.phase = "race"
	sim.paused = true
	var car = sim.cars[3]
	var fitted = TyreInventory.find(car, car.set_id)
	for key in WheelTyres.KEYS:
		fitted.wheels[key].life = 80.0
	fitted.wheels.FL.life = 24.8
	WheelTyres.publish(fitted)
	car.tyre = fitted.life
	car.temperature = fitted.temperature
	car.health = 79.6
	car.damage = 10.2
	car.fuel = 0.5
	car.engine = 2
	var before = JSON.stringify(RaceCar.records(sim.cars), "", true, true)
	var rng = sim.rng_state
	var reading = MinimalDriverReadout.capture(sim, 3)
	check(
		reading.tyre_life == 24.8 and reading.tyre.ends_with("24%"),
		"Card uses lowest wheel tread, not a reassuring average"
	)
	check(
		reading.tyre_issue and reading.tyre_detail == "Low tread · FL",
		"Limiting wheel is explicit when tread is low"
	)
	check(
		reading.health == "79%" and reading.car_detail == "Damage 11%",
		"Mechanical health and damage are separate, not a fabricated combined score"
	)
	check(
		reading.fuel == "0.5 laps" and reading.fuel_issue and reading.fuel_detail.begins_with("~-"),
		"Fuel units and negative estimated finish margin are explicit"
	)
	car.next_set_id = "3-H1"
	car.next_compound = "H"
	check(
		MinimalDriverReadout.capture(sim, 3).set_id == fitted.id,
		"Planning a replacement does not publish it as fitted"
	)
	car.next_set_id = ""
	car.next_compound = "M"
	for j in range(30):
		MinimalDriverReadout.capture(sim, 3)
		MinimalDriverReadout.capture(sim, 6)
		MinimalRaceTiming.rows(sim)
	check(
		(
			before == JSON.stringify(RaceCar.records(sim.cars), "", true, true)
			and rng == sim.rng_state
		),
		"Cards and timing neither synchronize stock nor consume randomness"
	)
	check(
		(
			MinimalDriverReadout.capture(sim, 0).is_empty()
			and MinimalDriverReadout.capture(sim, -1).is_empty()
		),
		"Readout does not expose rival resources or invalid identities"
	)
	fitted.wheels.RR.punctured = true
	check(
		MinimalDriverReadout.capture(sim, 3).tyre_detail == "Puncture · RR",
		"Puncture takes precedence over ordinary tread detail"
	)
	car.set_id = "missing"
	check(
		MinimalDriverReadout.capture(sim, 3).tyre == "Unavailable",
		"Missing fitted data is unknown, never an invented full set"
	)
	car.set_id = fitted.id
	check(
		MinimalRaceTiming.format_time(59.9996) == "1:00.000",
		"Lap-time millisecond rounding carries into next minute"
	)
	check(
		MinimalRaceTiming.format_time(83.456) == "1:23.456",
		"Measured precision remains milliseconds"
	)
	check(
		MinimalRaceTiming.format_time(0) == "—" and MinimalRaceTiming.format_time(NAN) == "—",
		"Absent or invalid lap times do not become zeros"
	)
	sim.phase = "qualifying"
	car.qual_best = 83.456
	car.dnf = true
	sim.cars[6].qual_best = 83.456
	var rows = MinimalRaceTiming.rows(sim)
	check(
		rows[0].id == 3 and rows[1].id == 6,
		"Equal qualifying times have stable grid-based tie ordering"
	)
	check(
		rows[0].time == "1:23.456" and rows[0].tag == "RET",
		"Retirement retains the valid measured lap and separate retired status"
	)
	check(rows[2].time == "—", "Untimed qualifying car is visibly untimed")
	sim.phase = "practice"
	check(
		MinimalRaceTiming.rows(sim).all(func(row): return row.time == "—"),
		"Practice cannot borrow qualifying measurements"
	)
	sim.phase = "formation"
	car.dnf = false
	for c in sim.cars:
		c.distance = c.id * 100.0
	rows = MinimalRaceTiming.rows(sim)
	check(
		rows[0].id == 0 and rows[11].id == 11 and rows[11].position == 12,
		"Formation tower retains all grid positions rather than physical travel order"
	)
	sim.phase = "race"
	for c in sim.cars:
		c.distance = 100.0
		c.dnf = false
	sim.cars[0].distance = sim.track.length * 2.2
	rows = MinimalRaceTiming.rows(sim)
	check(
		rows[0].time == "Leader" and rows[1].time == "+2 L",
		"Live timing reports whole-lap deficits separately from second estimates"
	)
	sim.cars[0].distance = 150.0
	check(
		MinimalRaceTiming.rows(sim)[1].time.begins_with("~+"),
		"Distance-derived live gaps remain explicitly approximate"
	)
	sim.phase = "results"
	for c in sim.cars:
		c.dnf = true
	check(
		MinimalRaceTiming.rows(sim).all(func(row): return row.time == "DNF"),
		"All-retired results invent neither a winner nor live time gaps"
	)
	sim.cars[0].dnf = false
	sim.cars[0].finished = true
	sim.cars[0].completed = 3
	sim.cars[0].finish_time = 250.0
	car.dnf = false
	car.finished = true
	car.completed = 3
	car.finish_time = 251.25
	sim.cars[6].dnf = false
	sim.cars[6].finished = true
	sim.cars[6].completed = 2
	sim.cars[6].finish_time = 248.0
	rows = MinimalRaceTiming.rows(sim)
	check(
		rows[0].time == "Winner" and rows[1].time == "+1.250" and rows[2].time == "+1 L",
		"Final classification uses actual laps and finish timestamps, never live speed"
	)
	check(
		MinimalDriverReadout.capture(sim, 3).fuel_detail == "Remaining at finish",
		"Finished cards stop projecting a future stint"
	)
	car.dnf = true
	car.finished = false
	car.retire_reason = "Out of fuel"
	check(
		MinimalDriverReadout.capture(sim, 3).retire_reason == "Out of fuel",
		"Retirement explanation uses the recorded reason"
	)


func test_driver_context() -> void:
	# Explicit synthetic read-model boundaries, distinct from the native physical journey.
	var sim = fixture()
	sim.phase = "race"
	sim.paused = true
	for c in sim.cars:
		c.route = "garage"
	var car = sim.cars[3]
	car.route = "track"
	car.speed = 40
	car.distance = 800.0
	car.pace = 1
	car.damage = 0
	car.loss = 0
	var first = MinimalDriverReadout.capture(sim, 3)
	check(
		first.stress.value == 15 and first.stress.band == "Low",
		"Stress has a documented clean-running baseline, not random filler"
	)
	car.pace = 2
	var pushing = MinimalDriverReadout.capture(sim, 3)
	check(
		(
			pushing.stress.value == 35
			and pushing.stress.text.begins_with("~")
			and "Push" in pushing.stress.reason
		),
		"Push raises explicitly estimated demand and states its input"
	)
	car.pace = 0
	check(
		MinimalDriverReadout.capture(sim, 3).stress.value == 7,
		"Existing Calm pace lowers current demand without another action"
	)
	car.pace = 2
	sim.cars[6].route = "track"
	sim.cars[6].distance = 805
	sim.cars[6].speed = 40
	check(
		MinimalDriverReadout.capture(sim, 3).stress.value > pushing.stress.value,
		"Real along-track traffic raises driving-demand estimate"
	)
	sim.cars[6].distance = 1800
	check(
		MinimalDriverReadout.capture(sim, 3).stress.value == pushing.stress.value,
		"Distant track stations do not create pressure from apparent 2D proximity"
	)
	car.damage = 50
	car.loss = 2
	var fitted = TyreInventory.find(car, car.set_id)
	fitted.wheels.FL.punctured = true
	var high = MinimalDriverReadout.capture(sim, 3)
	check(
		(
			high.stress.value <= 100
			and high.stress.band == "High"
			and "Puncture" in high.stress.reason
		),
		"Combined demand is bounded and explains the affected tyre"
	)
	check(
		"No performance effect" in high.stress.reason,
		"Stress does not pretend to be an implemented performance mechanic"
	)
	check(
		MinimalDriverReadout.capture(sim, 6).stress.value < high.stress.value,
		"Stress belongs to each driver, not the selected card or teammate"
	)
	var before = JSON.stringify(sim.snapshot())
	for i in range(200):
		MinimalDriverReadout.capture(sim, 3)
		MinimalDriverReadout.capture(sim, 6)
	check(
		before == JSON.stringify(sim.snapshot()),
		"Two hundred card refreshes cannot mutate state, history, RNG or time"
	)
	car.finished = true
	check(
		MinimalDriverReadout.capture(sim, 3).stress.value == -1,
		"No live stress estimate persists after the finish"
	)
	car.finished = false
	car.dnf = true
	check(
		MinimalDriverReadout.capture(sim, 3).stress.text == "—",
		"Retired driver has unavailable stress, not a fake zero"
	)
	car.dnf = false
	car.route = "garage"
	check(
		MinimalDriverReadout.capture(sim, 3).stress.value == -1,
		"Garage driver is not assigned active driving demand"
	)
	car.route = "track"
	sim.phase = "lights"
	check(
		MinimalDriverReadout.capture(sim, 3).stress.value == -1,
		"Stationary start lights are not presented as active driving stress"
	)
	sim.phase = "qualifying"
	car.qual_best = 83.456
	car.qual_history = [{"time": 83.456, "valid": true}, {"time": 82.5, "valid": false}]
	check(
		MinimalDriverReadout.capture(sim, 3).lap.last == "1:23.456",
		"Invalid qualifying lap cannot replace the last valid measured attempt"
	)
	sim.phase = "practice"
	sim.practice_driver(3).runs = [{"samples": [{"seconds": 87.25}, {"seconds": 86.5}]}]
	var reading = MinimalDriverReadout.capture(sim, 3)
	check(
		reading.lap.last == "1:26.500" and reading.lap.best == "1:26.500",
		"Practice card uses actual practice seconds, never qualifying data"
	)
	check(
		"Best measured" in reading.context,
		"Practice distinguishes measured observation from valid qualifying classification"
	)
	sim.phase = "formation"
	reading = MinimalDriverReadout.capture(sim, 3)
	check(
		reading.lap.label == "QUALIFYING" and reading.lap.last == "1:23.456",
		"Grid-phase timing is explicitly the qualifying result"
	)
	sim.phase = "race"
	car.last_lap = 91.234
	car.best_lap = 84
	car.history = [{"pit_lap": true}]
	reading = MinimalDriverReadout.capture(sim, 3)
	check(
		reading.lap.label == "LAST · PIT LAP" and reading.lap.last == "1:31.234",
		"A slow pit lap is labeled, not confused with clean pace"
	)
	car.engine_temperature = 122
	car.speed = 50
	reading = MinimalDriverReadout.capture(sim, 3)
	check(
		(
			reading.engine_hot
			and reading.engine_temp == "Engine 122°C"
			and reading.speed == "180 km/h"
		),
		"Engine heat and speed use actual simulation values and units"
	)
	for c in sim.cars:
		c.dnf = c.id not in [0, 3, 6]
		c.finished = false
	sim.cars[0].distance = 880
	sim.cars[0].speed = 40
	sim.cars[6].distance = 760
	sim.cars[6].speed = 40
	car.distance = 800
	car.speed = 40
	reading = MinimalDriverReadout.capture(sim, 3)
	check(
		(
			"Ahead" in reading.context
			and "~2.0s" in reading.context
			and "Behind" in reading.context
			and "~1.0s" in reading.context
		),
		"Neighbor gaps are signed by explicit Ahead/Behind and marked as estimates"
	)
	sim.cars[0].finished = true
	sim.cars[0].finish_position = 1
	sim.cars[0].completed = sim.laps
	check(
		(
			"finished" in MinimalDriverReadout.capture(sim, 3).context
			and not "Leading" in MinimalDriverReadout.capture(sim, 3).context
		),
		"A finished leader cannot make the next running car falsely appear to lead"
	)
	var gap_front = RaceCar.new()
	var gap_back = RaceCar.new()
	gap_front.distance = 200.0
	gap_front.speed = 0.0
	gap_back.distance = 100.0
	check(
		MinimalDriverContext.gap_text(sim, gap_front, gap_back) == "—",
		"Stationary time-gap estimation remains unknown"
	)
	gap_front.distance = sim.track.length * 2.5
	gap_front.speed = 40.0
	gap_back.distance = 0.0
	check(
		MinimalDriverContext.gap_text(sim, gap_front, gap_back) == "2 L",
		"Whole-lap deficits are not expressed as precise seconds"
	)
	check(
		(
			MinimalDriverReadout.capture(sim, 0).is_empty()
			and MinimalDriverReadout.capture(sim, -1).is_empty()
		),
		"Private card information is only exposed for managed drivers"
	)
	# Real supported continuation, no synthetic pressure state added to the archive.
	sim = fixture()
	var control = controller(sim)
	control.advance_stage()
	control.send_out(3)
	control.play()
	for i in range(300):
		sim.step()
	var restored = PracticeRaceSim.restore_practice(
		JSON.parse_string(JSON.stringify(sim.snapshot(), "", false, true))
	)
	check(restored != null, "Enriched cards require no checkpoint migration")
	if restored:
		check(
			same(MinimalDriverReadout.capture(sim, 3), MinimalDriverReadout.capture(restored, 3)),
			"Stress and card readouts reproduce from the restored authoritative state"
		)
		for i in range(300):
			sim.step()
			restored.step()
			MinimalDriverReadout.capture(sim, 3)
			MinimalDriverReadout.capture(sim, 6)
		check(
			same(sim.snapshot(), restored.snapshot()),
			"Showing enriched cards for one of two equivalent runs leaves sporting state and RNG identical"
		)


func run() -> void:
	var started = Time.get_ticks_msec()
	geometry = TrackGeometry.new(Storage.read_catalog().data[7])
	test_observation_and_ownership()
	test_pit_deadlines()
	test_recorded_modes()
	test_strategy_comparison_query()
	test_readouts_and_timing()
	test_driver_context()
	var report = {
		"passed": failures.is_empty(),
		"checks": checks,
		"failures": failures,
		"metrics": metrics,
		"elapsed_seconds": (Time.get_ticks_msec() - started) / 1000.0
	}
	Storage.write_json("res://reports/minimal-tests.json", report)
	print("MINIMAL_TESTS ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
