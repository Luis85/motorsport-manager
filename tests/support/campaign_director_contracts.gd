class_name CampaignDirectorContracts
extends RefCounted
## TM-11/TM-12 complete first-loop contract over the real campaign/weekend seams.

static func run(check: Callable) -> void:
	var loaded = ContentPackLoader.new().load_packs(["res://content/packs/core"])
	check.call(loaded.ok, "Starter fixture loads the validated core content pack")
	if not loaded.ok: return
	var campaign = loaded.catalog.default_campaign()
	check.call(campaign != null, "Core content exposes one default Team Principal campaign")
	if campaign == null: return
	var track = Storage.read_json("res://data/tracks/hillside.json").data
	var record = _record(track, loaded.catalog, campaign)
	check.call(record != null, "Starter fixture creates a recorded authored race entry")
	if record == null: return
	var checkpoint = CampaignStarter.create(record, campaign.to_record(), _circuits(loaded.catalog, campaign))
	check.call(not checkpoint.is_empty() and CampaignCheckpoint.validate(checkpoint).is_empty(),
		"Team Principal starter creates one valid four-event campaign checkpoint")
	if checkpoint.is_empty(): return
	check.call(not CampaignStarter.content(checkpoint).is_empty() \
			and CampaignStarter.definition(checkpoint).id == campaign.id,
		"Starter freezes authored campaign and weekend content into the career checkpoint")
	var detached_definition = CampaignStarter.definition(checkpoint)
	detached_definition.career.opening_cash_minor = 1
	check.call(CampaignStarter.definition(checkpoint).career.opening_cash_minor == 150000,
		"Campaign content projections are detached and cannot mutate the frozen career")
	var frozen_circuits = CampaignStarter.circuits(checkpoint)
	check.call(frozen_circuits.size() == 4 and frozen_circuits.has("core.circuit.hillside")
			and frozen_circuits.has("core.circuit.spa"),
		"Starter freezes every authored calendar circuit into the career")
	var starter_state = CampaignCheckpoint.restore(checkpoint)
	var starter_season: Dictionary = starter_state.competition.seasons[campaign.to_record().series.season_id]
	check.call(starter_season.calendar[0].track_hash != starter_season.calendar[1].track_hash,
		"Authored rounds carry distinct frozen track hashes rather than one reused starter circuit")
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
		CampaignStarter.event_cost_minor(checkpoint))
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

static func _record(track: Dictionary, catalog: ContentCatalog, campaign: CampaignDefinition) -> RaceRecord:
	var launch = WeekendLaunch.new(catalog)
	if not launch.stage_preset(campaign.weekend_id, track): return null
	var probe = PracticeRaceSim.new(launch.visual_track(), launch.session_options())
	if not probe.last_error.is_empty(): return null
	var profiles: Array = []
	for _car in probe.cars: profiles.append(RacePerformanceProfile.baseline())
	var options = launch.session_options()
	options["performance_profiles"] = profiles
	var simulation = PracticeRaceSim.new(launch.visual_track(), options)
	if not simulation.last_error.is_empty(): return null
	var record = RaceRecord.new(); record.attach(simulation)
	record.set_meta("campaign_test_source", simulation)
	return record

static func _circuits(catalog: ContentCatalog, campaign: CampaignDefinition) -> Dictionary:
	var result = {}
	for event in campaign.to_record().calendar:
		var definition = catalog.circuit(event.circuit_id)
		if definition == null: return {}
		result[event.circuit_id] = definition.document()
	return result
