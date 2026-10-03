extends SceneTree
## Characterization captured against the unchanged 0.17.2 source, not a new expected outcome.
const BASELINE_SHA = "15932dd4ac1650281628ad1412e98a3df85f45c6"
const CASES = [
	{"track": "hillside", "scenario": "dry", "seed": 7314, "intensity": "calm"},
	{"track": "monaco", "scenario": "wet", "seed": 2026, "intensity": "standard"},
	{"track": "monza", "scenario": "changeable", "seed": 942, "intensity": "volatile"},
]
var checks: int = 0
var errors: Array[String] = []


func _initialize() -> void:
	call_deferred("run")


func check(condition: bool, label: String) -> void:
	checks += 1
	if not condition:
		errors.append(label)
		print("CHARACTERIZATION_FAILURE ", label)


func compare_checkpoints(rows: Array, baseline: Variant) -> void:
	var shaped = baseline is Dictionary and baseline.get("cases") is Array
	check(shaped, "Baseline supplies an explicit array of characterization cases")
	if not shaped:
		return
	var reference: Array = baseline.cases
	check(reference.size() == CASES.size(), "Baseline retains all three declared case recipes")
	if reference.size() != CASES.size():
		return
	for index in range(CASES.size()):
		compare_case(rows[index], reference[index], CASES[index])


func compare_case(row: Dictionary, baseline: Variant, recipe: Dictionary) -> void:
	var label = "%s/%s seed %d" % [recipe.track, recipe.scenario, recipe.seed]
	var shaped = (
		baseline is Dictionary
		and baseline.get("recipe") is Dictionary
		and baseline.get("hashes") is Array
	)
	check(shaped, label + " baseline supplies a recipe and checkpoint array")
	if not shaped:
		return
	var matching = RaceRecord.equivalent(recipe, baseline.recipe)
	check(matching, label + " baseline identifies the same complete recipe")
	if not matching:
		return
	var hashes: Array = baseline.hashes
	check(hashes.size() == 8, label + " baseline retains eight declared checkpoint hashes")
	if hashes.size() != 8:
		return
	for index in range(8):
		check(
			row.hashes[index] == hashes[index],
			"%s tick %d matches the unchanged baseline fingerprint" % [label, (index + 1) * 500]
		)


func exercise(recipe: Dictionary) -> Dictionary:
	var read = Storage.read_json("res://config/circuits/%s.json" % recipe.track)
	var sim = (
		PracticeRaceSim
		. new(
			TrackGeometry.new(read.data),
			{
				"laps": 6,
				"scenario": recipe.scenario,
				"seed": recipe.seed,
				"intensity": recipe.intensity,
				"tactical_duels": true,
			}
		)
	)
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
		"recipe": recipe,
		"formation_steps": formation_steps,
		"commands_accepted": accepted,
		"hashes": states,
		"pits": sim.stats.pits,
		"rng_state": sim.rng_state,
	}


func run() -> void:
	var rows: Array = []
	for recipe in CASES:
		rows.append(exercise(recipe))
		print("CHARACTERIZATION_CASE ", JSON.stringify(rows.back()))
	var actual = {
		"baseline_sha": BASELINE_SHA, "engine": Engine.get_version_info().string, "cases": rows
	}
	var expected = Storage.read_json("res://tests/fixtures/architecture-reference.json")
	check(
		expected.ok and RaceRecord.equivalent(actual, expected.data),
		"The complete characterization manifest matches the unchanged baseline"
	)
	compare_checkpoints(rows, expected.data if expected.ok else null)
	var passed = errors.is_empty()
	var report = {"passed": passed, "checks": checks, "errors": errors, "actual": actual}
	Storage.write_json("res://reports/architecture-characterization.json", report)
	print("ARCHITECTURE_CHARACTERIZATION ", JSON.stringify(report))
	quit(0 if passed else 1)
