extends SceneTree
## Focused rule ownership checks complement, never replace, sporting characterization.
var checks = 0
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value: failures.append(message); push_error(message)

func rejected(sim: RaceSim, action: String, payload: Dictionary, message: String) -> void:
	var before = sim.snapshot()
	var history = sim.commands.duplicate(true)
	check(not sim.command(action, payload), "Rule rejects " + action)
	check(sim.last_error == message, "Validation precedence is explicit for " + action + ": " + sim.last_error)
	check(RaceRecord.equivalent(before, sim.snapshot()) and history == sim.commands, "Rejected rule preserves all resources, RNG and accepted history: " + action)

func run() -> void:
	var track = TrackGeometry.new(Storage.read_json("res://data/tracks/hillside.json").data)
	for profile in ["base", "practice"]:
		var sim = RaceSim.new(track) if profile == "base" else PracticeRaceSim.new(track)
		# The outer mechanic profile can own additional policy. These common target
		# rules are checked through the unchanged aggregate command entrypoint.
		rejected(sim, "pace", {"id": 0, "value": 9}, "You manage the two Obsidian drivers only." if profile == "base" else "Only a running Obsidian driver can receive this command.")
		rejected(sim, "pace", {"id": 3, "value": 9}, "Invalid driving mode." if profile == "base" else "Choose a valid driving mode.")
		var unrelated = sim.cars[6].to_record()
		var time = sim.total_time
		var rng = sim.rng_state
		var count = sim.commands.size()
		check(sim.command("engine", {"id": 3, "value": 0}), "Existing driver mode remains independently accepted")
		check(sim.cars[3].engine == 0 and not sim.cars[3].auto, "Mode update changes only its intended driver mode and delegation")
		check(sim.cars[6].to_record() == unrelated and sim.total_time == time and sim.rng_state == rng, "Driver mode cannot initialize a grid or touch unrelated entrants")
		check(sim.commands.size() == count + 1 and sim.commands.back().action == "engine", "Aggregate records the accepted driver order once")
		var events = sim.events.filter(func(event): return event.kind == "radio" and "engine" in event.text)
		check(events.size() == 1, "Aggregate publishes the existing mode radio once")
		# Validate the entire setup payload before changing even its first field.
		rejected(sim, "setup_all", {"id": 3, "values": {"wing": 4, "unknown": 2}}, "Setup value is outside the available range.")
		check(sim.command("setup_all", {"id": 3, "values": {"wing": 4}}), "Focused garage setup remains available")
		check(sim.cars[3].car_setup.wing == 4 and sim.cars[3].setup == 4, "Setup retains its compatibility projection")
	# Base validation order is contractual even for global and unknown commands.
	var base = RaceSim.new(track)
	for action in ["speed", "pause", "qualify", "unknown"]:
		rejected(base, action, {"id": -1, "value": 3}, "Unknown driver.")
	rejected(base, "pause", {}, "No live session to pause.")
	rejected(base, "speed", {"value": 3}, "Invalid simulation speed.")
	check(base.command("speed", {"value": 16}) and base.speed == 16, "Clock order remains independently understandable")
	check(base.command("prepare_race"), "Existing grid preparation is delegated without changing its aggregate boundary")
	var prepared = base.snapshot()
	# Unusable final entrant must reject before mounting ANY starting set.
	var last = base.cars.back()
	last.tyre_sets.clear()
	rejected(base, "formation", {}, last.short + ": select a usable starting set before formation.")
	check(base.cars[3].set_id == prepared.cars[3].set_id, "Formation performs validation before all tyre mounts")
	var pit_sim = RaceSim.new(track)
	check(pit_sim.command("prepare_race") and pit_sim.command("formation"), "Pit rule fixture starts an ordinary formation")
	# A route/phase-invalid pit request cannot consume stock or consume RNG.
	rejected(pit_sim, "pit", {"id": 3}, "Pit calls require a car racing on track.")
	rejected(pit_sim, "schedule_pit", {"id": 3, "lap": 0}, "Schedule an on-track car with no existing pit order.")
	check(pit_sim.command("compound", {"id": 3, "value": "H"}), "Finite inventory planning remains available through the aggregate")
	check(pit_sim.cars[3].next_compound == "H", "Pit planning delegates to existing inventory policy")
	var report = {"passed": failures.is_empty(), "checks": checks, "failures": failures}
	Storage.write_json("res://reports/command-responsibility-tests.json", report)
	print("COMMAND_RESPONSIBILITIES ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
