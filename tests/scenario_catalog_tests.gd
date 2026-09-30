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
	# A malformed recipe must invalidate the entire collection, not merely hide one
	# gallery card while another caller still receives an unchecked recipe.
	for family in expected:
		var original = ScenarioCatalog.collection(family)
		var valid_copy = copied(original)
		check(ScenarioCatalog.validate_collection(valid_copy, family) == original, family + " family validation preserves the authored order and bytes")
		valid_copy.scenarios[0].title = "Mutated after copy"
		check(ScenarioCatalog.collection(family) == original, family + " returns a detached collection")
		for mutation in ["missing_metadata", "blank_title", "too_long", "unknown_root", "invalid_notice", "malformed_id", "unknown_recipe", "missing_reference", "duplicate_id", "empty_array", "over_limit"]:
			var broken = copied(original)
			match mutation:
				"missing_metadata": broken.erase("title")
				"blank_title": broken.title = "  "
				"too_long": broken.description = "x".repeat(1201)
				"unknown_root": broken["execute"] = "res://untrusted.gd"
				"invalid_notice": broken["notice"] = true
				"malformed_id": broken.scenarios[0].id = "invalid/id"
				"unknown_recipe": broken.scenarios[0]["callback"] = "res://untrusted.gd"
				"missing_reference": broken.scenarios[0].erase("track")
				"duplicate_id": broken.scenarios.append(copied(broken.scenarios[0]))
				"empty_array": broken.scenarios = []
				"over_limit":
					broken.scenarios = []
					for i in range(ScenarioCatalog.MAX_SCENARIOS + 1): broken.scenarios.append(original.scenarios[0].duplicate(true))
			check(ScenarioCatalog.validate_collection(broken, family).is_empty(), family + " fails closed: " + mutation)
		var changed = copied(original)
		match family:
			"dry":
				changed.scenarios[0].plans[0]["script"] = "res://untrusted.gd"
				check(ScenarioCatalog.validate_collection(changed, family).is_empty(), "Dry plans reject unexpected nested executable fields")
				changed = copied(original); changed.scenarios[0].plans[0].starting = ""
			"weather": changed.scenarios[0].weather_mode = "unregistered"
			"recovery": changed.scenarios[0].damage[0] = -3
			"practice": changed.scenarios[0].scenario = "unknown"
			"rivals", "duels": changed.scenarios[0].grid[1] = changed.scenarios[0].grid[0]
		check(ScenarioCatalog.validate_collection(changed, family).is_empty(), family + " rejects an invalid family-specific recipe")
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
