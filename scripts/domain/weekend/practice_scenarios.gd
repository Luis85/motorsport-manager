class_name PracticeScenarios
extends RefCounted
static func catalog() -> Array:
	return [
		{"id": "spend-a-set-to-learn", "title": "Spend a set to learn", "scenario": "dry", "seed": 2026,
		"objective": "Choose whether better tyre-life evidence is worth using a real set before a 12-lap race.",
		"hint": "Optional practice: try MER on medium tyres and MOR on hard tyres. Wait for clear air to collect comparable laps. Or skip and retain stock; neither route grants a hidden bonus."},
		{"id": "two-setups-one-question", "title": "Two setups, one question", "scenario": "wet", "seed": 86,
		"objective": "Compare a current setup with a stable-wet alternative, without a hidden perfect score.",
		"hint": "Practice on the same driver, compound and modes where possible. Different water, tyre age, fuel and traffic can confound a lap-time difference. The report distinguishes measured findings from estimates."}
	]
static func build(recipe: Dictionary, library: Array) -> PracticeRaceSim:
	if not recipe in catalog(): return null
	for document in library:
		if document.id != "hillside": continue
		var geometry = TrackGeometry.new(document, "Formula")
		if TrackDiagnostics.blocking(TrackDiagnostics.inspect(geometry)): return null
		var sim = PracticeRaceSim.new(geometry, {"laps": 12, "scenario": recipe.scenario, "seed": recipe.seed, "intensity": "calm"})
		RaceJournal.append(sim.strategy_state, sim, "scenario", -1, {"id": recipe.id, "title": recipe.title, "objective": recipe.objective, "hint": recipe.hint,
			"track_hash": JSON.stringify(document).sha256_text(), "ruleset": "native-optional-practice-v1", "assists": "Calm incidents for everyone; optional practice; normal finite allocation; no forced outcome."})
		return sim
	return null
