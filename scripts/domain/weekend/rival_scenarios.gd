class_name RivalScenarios
extends RefCounted
## Disclosed preparation starts; no generated qualifying times, incidents or winners.
static func catalog() -> Array:
	return [
		{"id":"faster-car-behind", "title":"Faster car behind", "seed":7314, "laps":12, "life":40.0,
		"grid":[1,2,3,0,4,5,6,7,8,9,10,11],
		"objective":"Bring both cars home; protect Mercer's P3 or trade it for a later tyre offset.",
		"hint":"Valenti starts immediately behind Mercer with his existing higher skill. Defend within limits, conserve the fitted set, or spend a stop for fresh tyres. No stat boost or forced pass is applied."},
		{"id":"both-cars-in-contention", "title":"Both cars in contention", "seed":2026, "laps":16, "life":50.0,
		"grid":[0,3,1,6,2,4,5,7,8,9,10,11],
		"objective":"Finish with both cars; compare splitting stop timing against managing the shared box together.",
		"hint":"MER starts P2 and MOR P4. Early fresh tyres and a longer stint are alternatives, not guaranteed gains. Read public rival styles; keep the other car's decision in view."}
	]
static func build(recipe: Dictionary, library: Array) -> PracticeRaceSim:
	if recipe not in catalog(): return null
	for document in library:
		if document.id != "hillside": continue
		var geometry = TrackGeometry.new(document, "Formula")
		if TrackDiagnostics.blocking(TrackDiagnostics.inspect(geometry)): return null
		var sim = PracticeRaceSim.new(geometry, {"laps":recipe.laps, "seed":recipe.seed, "scenario":"dry", "intensity":"calm"})
		sim.practice_state.status = "skipped"
		for i in range(recipe.grid.size()):
			var c = sim.cars[recipe.grid[i]]
			c.grid = i + 1; c.distance = -i * geometry.grid_spacing; c.previous_distance = c.distance
			c.lane = (-1 if i % 2 == 0 else 1) * 2.0
			var fitted = TyreInventory.find(c, c.set_id)
			for wheel in fitted.wheels.values(): wheel.life = recipe.life
			WheelTyres.publish(fitted); c.tyre = fitted.life; c.temperature = fitted.temperature
			c.next_compound = fitted.compound; c.next_set_id = fitted.id # Explicit starting set survives the formation fit.
		sim.transition("race_preparation")
		for id in [3,6]: sim.command("delegation", {"id":id,"channel":"pit","owner":"player"})
		var disclosure = "Curated untimed grid; starts at preparation, skipping practice/qualifying. Every fitted M1 begins at %.0f%% tread; other driver-owned stock is unchanged. Dry, calm incidents, manual player pits. Physical formation/start approvals remain. No forced outcome." % recipe.life
		RaceJournal.append(sim.strategy_state, sim, "scenario", -1, {"id":recipe.id, "title":recipe.title, "objective":recipe.objective, "hint":recipe.hint,
			"track_hash":JSON.stringify(document).sha256_text(), "ruleset":"contextual-rivals-v1", "assists":disclosure})
		sim.post("weekend", recipe.title + ": " + recipe.objective + " " + disclosure)
		return sim
	return null
