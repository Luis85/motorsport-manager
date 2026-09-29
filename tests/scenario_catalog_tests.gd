extends SceneTree
## Bundled developer scenario collections are bounded data, not executable outcome scripts.
var checks = 0
var failures: Array[String] = []
func _initialize() -> void: call_deferred("run")
func check(value: bool, message: String) -> void:
	checks += 1
	if not value: failures.append(message); push_error(message)
func copied(value): return JSON.parse_string(JSON.stringify(value, "", false, true))
func run() -> void:
	var expected = {"dry":4, "weather":3, "recovery":2, "duels":4, "practice":2, "rivals":2}
	for family in expected:
		var collection = ScenarioCatalog.collection(family)
		check(collection.get("version") == 1, family + " collection is versioned")
		check(ScenarioCatalog.read(family).size() == expected[family], family + " collection exposes the expected bounded recipes")
	check(ScenarioCatalog.collection("unknown").is_empty() and ScenarioCatalog.read("unknown").is_empty(), "Unknown collections fail closed")
	for invalid in [
		{}, {"version":2,"title":"T","description":"D","scenarios":[]}, {"version":1,"title":"T","description":"D","scenarios":[]},
		{"version":1,"scenarios":[{"id":"a","title":"A","objective":"O","hint":"H"}]},
		{"version":1,"title":"T","description":"D","scenarios":[{"id":"a","title":"A","objective":"O","hint":"H"},{"id":"a","title":"B","objective":"O","hint":"H"}]},
		{"version":1,"title":"T","description":"D","scenarios":[{"id":"a","title":"A","objective":"O"}]},
	]: check(ScenarioCatalog.validate_collection(invalid).is_empty(), "Malformed/duplicate collection rejects atomically")
	for family in expected:
		var collection = ScenarioCatalog.collection(family)
		check(not str(collection.get("title", "")).is_empty() and not str(collection.get("description", "")).is_empty(), family + " collection owns its gallery presentation metadata")
	var practice = PracticeScenarios.catalog()
	check(practice.size() == 2 and practice.all(func(r): return PracticeScenarios.valid(r)), "Practice recipes moved from code into validated shipped data")
	var rivals = RivalScenarios.catalog()
	check(rivals.size() == 2 and rivals.all(func(r): return RivalScenarios.valid(r)), "Rival recipes moved from code into validated shipped data")
	var bad = copied(practice[0]); bad.seed = -1
	check(not PracticeScenarios.valid(bad), "Practice recipe rejects invalid seed")
	bad = copied(rivals[0]); bad.grid[1] = bad.grid[0]
	check(not RivalScenarios.valid(bad), "Rival recipe rejects duplicate grid entrant")
	bad = copied(rivals[0]); bad.life = 101
	check(not RivalScenarios.valid(bad), "Rival recipe rejects impossible fitted tread")
	var library = Storage.read_catalog().data
	check(PracticeScenarios.build(practice[0], library) != null, "File-backed practice recipe builds the ordinary simulation")
	check(RivalScenarios.build(rivals[0], library) != null, "File-backed rival recipe builds the ordinary simulation")
	var report = {"passed":failures.is_empty(),"checks":checks,"failures":failures}
	Storage.write_json("res://reports/scenario-catalog-tests.json",report); print("SCENARIO_CATALOG_TESTS ",JSON.stringify(report)); quit(0 if failures.is_empty() else 1)
