class_name ContentScenarioDefinition
extends RefCounted
## A complete existing weekend plus an inert, persistent player-facing brief.
var _record: Dictionary = {}
var id: String:
	get: return _record.id

static func fields() -> Dictionary:
	return {"circuit_id": ContentSchema.identity(), "weekend_id": ContentSchema.identity(),
		"brief": ContentSchema.object({"version": {"enum": [1]},
			"title": ContentSchema.text(80), "briefing": ContentSchema.text(600),
			"approaches": ContentSchema.array(ContentSchema.text(240), 2, 2),
			"hint": ContentSchema.text(600), "goal": {"enum": ScenarioBrief.GOALS.keys()}})}

static func from_record(record: Variant) -> ContentScenarioDefinition:
	if not record is Dictionary:
		return null
	if not ContentValidation.check(record, ContentSchema.definition("scenario")).is_empty():
		return null
	if not ScenarioBrief.validate(record.brief).is_empty():
		return null
	var value = ContentScenarioDefinition.new()
	value._record = RaceStateValue.read_only(record)
	return value

func to_record() -> Dictionary:
	return _record.duplicate(true)

func brief() -> Dictionary:
	return _record.brief.duplicate(true)

static func valid_context(parent: Dictionary, weekend: Variant) -> bool:
	if not parent.has("content_scenario"):
		return true
	var context = parent.content_scenario
	if not context is Dictionary or context.size() != 2:
		return false
	if not context.get("track_id") is String or context.track_id.is_empty() or context.track_id.length() > 100:
		return false
	var scenario = from_record(context.get("definition"))
	if scenario == null or not parent.get("scenario") is Dictionary or not weekend is Dictionary:
		return false
	var source = scenario.to_record()
	return parent.scenario == source.brief and weekend.get("id") == source.weekend_id

static func valid_record_context(record: Dictionary) -> bool:
	var parent = record.get("parent", {})
	if not parent is Dictionary:
		return false
	if not parent.has("content_scenario"):
		return true
	if not record.get("initial") is Dictionary:
		return false
	var initial: Dictionary = record.initial
	if not valid_context(parent, initial.get("weekend_definition")):
		return false
	var track = initial.get("track")
	return track is Dictionary and track.get("id") == parent.content_scenario.track_id

static func valid_notebook_context(facts: Dictionary) -> bool:
	if not facts.has("content_scenario"):
		return true
	var context = facts.content_scenario
	if not context is Dictionary:
		return false
	var scenario = from_record(context.get("definition"))
	if scenario == null or not facts.get("challenge") is Dictionary:
		return false
	var brief = scenario.brief()
	if facts.origin not in ["standalone", "sandbox"] or facts.challenge.get("outcome") == "none":
		return false
	if facts.challenge.get("title") != brief.title or facts.challenge.get("goal") != brief.goal:
		return false
	return valid_context({"content_scenario": context, "scenario": brief}, facts.context.ruleset.get("weekend_definition"))
