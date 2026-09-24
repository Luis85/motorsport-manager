class_name ScenarioBrief
extends RefCounted
## Authored instructions are inert text. Goals inspect final sporting facts only.
const GOALS = {
	"observe": "Compare two approaches (no scored target)",
	"finish_both": "Bring both player cars home",
	"mer_top_six": "Finish Mercer in the top six",
	"mor_top_six": "Finish Moreau in the top six",
}

static func defaults() -> Dictionary:
	return {"version": 1, "title": "A different decision", "briefing": "Compare a deliberate hold with an alternative strategy from this checkpoint.",
		"approaches": ["Keep the current plan", "Change one decision and observe the cost"],
		"hint": "Compare completed laps as well as positions. Different decisions can change traffic, exposure and rival responses.", "goal": "observe"}

static func validate(data: Variant) -> String:
	if not data is Dictionary or not RaceCheckpoint.integral(data.get("version"), 1, 1): return "Unsupported scenario brief."
	for key in ["title", "briefing", "hint"]:
		var value = data.get(key)
		if not value is String or value.strip_edges().is_empty() or value.length() > (80 if key == "title" else 600):
			return "Enter a nonempty %s (at most %d characters)." % [key, 80 if key == "title" else 600]
	if not data.get("approaches") is Array or data.approaches.size() != 2: return "Describe two approaches."
	for value in data.approaches:
		if not value is String or value.strip_edges().is_empty() or value.length() > 240: return "Each approach needs 1–240 characters."
	if data.approaches[0].strip_edges() == data.approaches[1].strip_edges(): return "Describe two different approaches; their viability still needs testing."
	if data.get("goal") not in GOALS: return "Choose a supported observed goal."
	return ""

static func assessment(data: Dictionary, sim: RaceSim) -> String:
	if not validate(data).is_empty(): return "Scenario goal unavailable."
	if data.goal == "observe": return "Observation only · compare the actual outcomes; no score or reward."
	if sim.phase != "results": return "Goal pending · assessed only at final classification."
	var achieved = sim.cars[3].finished and sim.cars[6].finished
	if data.goal in ["mer_top_six", "mor_top_six"]:
		var car = sim.cars[3 if data.goal == "mer_top_six" else 6]
		achieved = car.finished and sim.standings().find(car) < 6
	return ("Goal met" if achieved else "Goal not met") + " · observed sandbox result; no campaign reward."

static func describe(data: Dictionary) -> String:
	return "%s\n%s\nA: %s\nB: %s\nGoal: %s\nHint: %s" % [data.title, data.briefing, data.approaches[0], data.approaches[1], GOALS[data.goal], data.hint]
