class_name CampaignDirectorContracts
extends RefCounted
## TM-11/TM-12 complete first-loop contract over the real campaign/weekend seams.

static func run(check: Callable) -> void:
	var track = Storage.read_json("res://data/tracks/hillside.json").data
	var record = _record(track)
	check.call(record != null, "Starter fixture creates a v12 recorded race entry")
	if record == null: return
	var checkpoint = CampaignStarter.create(record)
	check.call(not checkpoint.is_empty() and CampaignCheckpoint.validate(checkpoint).is_empty(),
		"Team Principal starter creates one valid four-event campaign checkpoint")
	if checkpoint.is_empty(): return
	var before_query = RaceStateValue.fingerprint(checkpoint)
	var desk = CampaignDirectorQuery.overview(checkpoint)
	check.call(desk.ok and desk.season.total_events == 4 and desk.next_event.round == 1,
		"Director Desk exposes the four-event slice and its next event")
	check.call(desk.priorities.size() <= 3 and desk.priorities[0].id == "depart",
		"Director Desk limits the opening decision queue and puts departure first")
	check.call(desk.onboarding.steps.size() == 4 and not desk.onboarding.steps[2].done,
		"Onboarding is derived from authoritative progress and is resumable")
	check.call(desk.rivals.size() == 5,
		"Starter campaign creates five bounded rival organizations around the player team")
	check.call(RaceStateValue.fingerprint(checkpoint) == before_query,
		"Director Desk and rival summaries are detached observations")
	var mappings = CampaignStarter.mappings(checkpoint)
	var assignments = CampaignStarter.event_assignments(checkpoint)
	check.call(mappings.size() == 12 and assignments.size() == 3,
		"Starter campaign preserves all twelve race mappings and explicit player event duty")
	var departed = CampaignDepartureTransaction.depart(checkpoint,
		CampaignStarter.next_event_context(checkpoint), record, mappings, assignments,
		CampaignStarter.EVENT_COST_MINOR)
	check.call(departed.ok and not departed.checkpoint.active_manifest.is_empty(),
		"Director departure freezes the exact existing race entry atomically")
	if not departed.ok: return
	var simulation: RaceSim = record.source.get_ref()
	simulation.phase = "results"
	for car in simulation.cars:
		car.dnf = false; car.finished = true; car.completed = simulation.laps
		car.finish_time = 900.0 + float(car.id); car.best_lap = 70.0 + float(car.id)
	var factual = WeekendResult.build(record)
	check.call(not factual.is_empty() and WeekendResult.validate(factual).is_empty(),
		"Completed campaign weekend emits the ordinary factual result envelope")
	if factual.is_empty(): return
	var policy = CampaignStarter.weekend_policy(departed.checkpoint)
	var settled = CampaignWeekendTransaction.stage(
		departed.checkpoint, departed.manifest, factual, policy)
	check.call(settled.ok and settled.status == "settled",
		"Campaign weekend settles through the exact existing consequence transaction")
	if not settled.ok: return
	var followed = CampaignDirectorTransaction.after_weekend(settled.checkpoint)
	check.call(followed.ok and followed.checkpoint.active_manifest.is_empty(),
		"Weekend follow-up returns control to the campaign and reviews due rivals")
	if not followed.ok: return
	var debrief = CampaignDirectorQuery.overview(followed.checkpoint)
	check.call(debrief.ok and debrief.season.completed_events == 1 		and not debrief.debrief.is_empty() and debrief.debrief.facts.size() >= 2,
		"Director Desk returns with factual sporting/financial debrief evidence")
	check.call(debrief.onboarding.steps[2].done,
		"First weekend settlement advances the resumable onboarding state")
	var advanced = CampaignDirectorTransaction.advance_to_next_event(followed.checkpoint)
	check.call(advanced.ok and advanced.status == "advanced",
		"Player can explicitly advance from debrief to the next event boundary")
	if not advanced.ok: return
	var next = CampaignDirectorQuery.overview(advanced.checkpoint)
	check.call(next.next_event.round == 2 and int(next.next_event.departure_slot) == int(next.slot),
		"Advance stops exactly at Round 2 departure rather than skipping a decision")
	check.call(followed.rivals_reviewed > 0 and advanced.rivals_reviewed == 0,
		"Rival review occurs at the dated weekend-return boundary and is not repeated before its next review slot")
	check.call(CampaignCheckpoint.validate(advanced.checkpoint).is_empty(),
		"Create, depart, settle, debrief and advance remain one valid persistent campaign")

static func _record(track: Dictionary) -> RaceRecord:
	var options = CampaignStarter.race_options()
	var probe = PracticeRaceSim.new(TrackGeometry.new(track, "Formula"), options)
	if not probe.last_error.is_empty(): return null
	var profiles: Array = []
	for _car in probe.cars: profiles.append(RacePerformanceProfile.baseline())
	options["performance_profiles"] = profiles
	var simulation = PracticeRaceSim.new(TrackGeometry.new(track, "Formula"), options)
	if not simulation.last_error.is_empty(): return null
	var record = RaceRecord.new(); record.attach(simulation)
	return record
