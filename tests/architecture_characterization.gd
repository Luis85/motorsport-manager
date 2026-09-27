extends SceneTree
## Characterization captured against the unchanged 0.17.2 source, not a new expected outcome.
const BASELINE_SHA = "15932dd4ac1650281628ad1412e98a3df85f45c6"
const CASES = [
	{"track": "hillside", "scenario": "dry", "seed": 7314, "intensity": "calm"},
	{"track": "monaco", "scenario": "wet", "seed": 2026, "intensity": "standard"},
	{"track": "monza", "scenario": "changeable", "seed": 942, "intensity": "volatile"},
]

func _initialize() -> void:
	call_deferred("run")

func exercise(recipe: Dictionary) -> Dictionary:
	var read = Storage.read_json("res://data/tracks/%s.json" % recipe.track)
	var sim = PracticeRaceSim.new(TrackGeometry.new(read.data), {
		"laps": 6, "scenario": recipe.scenario, "seed": recipe.seed,
		"intensity": recipe.intensity, "tactical_duels": true,
	})
	var states: Array = []
	var accepted: Array = []
	accepted.append(sim.command("prepare_race"))
	accepted.append(sim.command("formation"))
	var formation_steps = 0
	while sim.phase == "formation" and formation_steps < 20000:
		sim.step()
		formation_steps += 1
	accepted.append(sim.command("lights"))
	while sim.phase == "lights":
		sim.step()
	for index in range(4000):
		if index == 250:
			accepted.append(sim.command("pace", {"id": 3, "value": 2}))
		if index == 500:
			accepted.append(sim.command("engine", {"id": 6, "value": 0}))
		if index == 750:
			accepted.append(sim.command("pit", {"id": 3}))
		if index == 1500:
			accepted.append(sim.command("pace", {"id": 3, "value": 0}))
		sim.step()
		if (index + 1) % 500 == 0:
			states.append(RaceRecord.fingerprint(RaceRecord.sporting(sim.snapshot())))
	return {
		"recipe": recipe, "formation_steps": formation_steps,
		"commands_accepted": accepted, "hashes": states,
		"pits": sim.stats.pits, "rng_state": sim.rng_state,
	}

func run() -> void:
	var rows: Array = []
	for recipe in CASES:
		rows.append(exercise(recipe))
		print("CHARACTERIZATION_CASE ", JSON.stringify(rows.back()))
	var actual = {"baseline_sha": BASELINE_SHA, "engine": Engine.get_version_info().string, "cases": rows}
	var expected = Storage.read_json("res://tests/fixtures/architecture-reference.json")
	var passed = expected.ok and RaceRecord.equivalent(actual, expected.data)
	var report = {"passed": passed, "checks": rows.size() * 8, "actual": actual}
	Storage.write_json("res://reports/architecture-characterization.json", report)
	print("ARCHITECTURE_CHARACTERIZATION ", JSON.stringify(report))
	quit(0 if passed else 1)
