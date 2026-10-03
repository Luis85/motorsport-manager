class_name CampaignWeekendWorkflow
extends RefCounted
## Headless and native-shell orchestration over the same frozen campaign authorities.
## Candidates remain detached until their application owner publishes them.


static func create(catalog: ContentCatalog, campaign_id: String) -> Dictionary:
	if catalog == null:
		return _reject("A validated content catalog is required.")
	var campaign = catalog.campaign(campaign_id)
	if campaign == null:
		return _reject("Choose a validated authored campaign profile.")
	var definition = campaign.to_record()
	var circuits = {}
	for event in definition.calendar:
		var circuit = catalog.circuit(event.circuit_id)
		if circuit == null:
			return _reject("The authored campaign circuit calendar is unavailable.")
		circuits[event.circuit_id] = circuit.document()
	var launch = WeekendLaunch.new(catalog)
	if not launch.stage_preset(campaign.weekend_id, circuits[definition.calendar[0].circuit_id]):
		return _reject(launch.last_error)
	var probe = PracticeRaceSim.new(launch.visual_track(), launch.session_options())
	if not probe.last_error.is_empty():
		return _reject(probe.last_error)
	var profiles: Array = []
	for _car in probe.cars:
		profiles.append(RacePerformanceProfile.baseline())
	var options = launch.session_options()
	options["performance_profiles"] = profiles
	var simulation = PracticeRaceSim.new(launch.visual_track(), options)
	if not simulation.last_error.is_empty():
		return _reject(simulation.last_error)
	var record = RaceRecord.new()
	record.attach(simulation)
	var checkpoint = CampaignStarter.create(record, definition, circuits)
	record.detach()
	if checkpoint.is_empty():
		return _reject("The authored campaign could not form a complete checkpoint.")
	return {"ok": true, "error": "", "checkpoint": checkpoint}


static func prepare_race(checkpoint: Dictionary, document: Dictionary = {}) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return _reject(restored.error)
	if not restored.active_manifest.is_empty():
		return _reject("Another campaign weekend is already active.")
	var context = CampaignStarter.next_event_context(checkpoint)
	if context.is_empty():
		return _reject("There is no registered next campaign event.")
	var event = CampaignSeason.calendar_event(
		restored.competition.seasons[context.season_id], context.campaign_event_id
	)
	var track = document.duplicate(true)
	if track.is_empty():
		for frozen in CampaignStarter.circuits(checkpoint).values():
			if RaceStateValue.fingerprint(frozen) == event.track_hash:
				track = frozen.duplicate(true)
				break
	if track.is_empty() or RaceStateValue.fingerprint(track) != event.track_hash:
		return _reject("The frozen circuit does not match the registered next event.")
	var mappings = CampaignStarter.mappings(checkpoint)
	var profiles = CampaignEngineeringQuery.race_profiles(checkpoint, mappings)
	if not profiles.ok:
		return _reject(profiles.error)
	var options = CampaignStarter.race_options(checkpoint)
	options["performance_profiles"] = profiles.profiles
	var authored_vehicle = CampaignStarter.vehicle_definition(checkpoint)
	var vehicle = (
		VehicleDefinition.from_record(authored_vehicle) if not authored_vehicle.is_empty() else null
	)
	var geometry = TrackGeometry.new(track, CampaignStarter.vehicle(checkpoint), false, vehicle)
	var simulation = PracticeRaceSim.new(geometry, options)
	if not simulation.last_error.is_empty():
		return _reject(simulation.last_error)
	var record = RaceRecord.new()
	record.attach(simulation)
	return {"ok": true, "error": "", "simulation": simulation, "record": record}


static func readiness(checkpoint: Dictionary) -> Dictionary:
	var prepared = prepare_race(checkpoint)
	if not prepared.ok:
		return prepared
	var record: RaceRecord = prepared.record
	# A read model uses reproducible diagnostic identity, never a new sporting event.
	record.event_id = RaceStateValue.fingerprint(checkpoint).left(32)
	var manifest = CampaignWeekendManifest.build(
		CampaignStarter.next_event_context(checkpoint), record, CampaignStarter.mappings(checkpoint)
	)
	var result = CampaignReadinessQuery.evaluate(
		checkpoint,
		manifest,
		record.initial.get("performance_profiles", []),
		CampaignStarter.event_assignments(checkpoint),
		CampaignStarter.event_cost_minor(checkpoint)
	)
	record.detach()
	return result


static func depart(checkpoint: Dictionary, document: Dictionary = {}) -> Dictionary:
	var prepared = prepare_race(checkpoint, document)
	if not prepared.ok:
		return prepared
	var departed = CampaignDepartureTransaction.depart(
		checkpoint,
		CampaignStarter.next_event_context(checkpoint),
		prepared.record,
		CampaignStarter.mappings(checkpoint),
		CampaignStarter.event_assignments(checkpoint),
		CampaignStarter.event_cost_minor(checkpoint)
	)
	if not departed.ok:
		prepared.record.detach()
		return departed
	return {
		"ok": true,
		"error": "",
		"departed": departed,
		"simulation": prepared.simulation,
		"record": prepared.record
	}


static func settle(checkpoint: Dictionary, record: RaceRecord) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return _reject(restored.error)
	if restored.active_manifest.is_empty():
		return _reject("There is no active campaign weekend to settle.")
	if record == null:
		return _reject("The campaign weekend recording is unavailable.")
	var factual = WeekendResult.build(record)
	if factual.is_empty():
		return _reject("The weekend has not produced a valid factual finished result.")
	var policy = CampaignStarter.weekend_policy(checkpoint)
	if policy.is_empty():
		return _reject("The frozen campaign weekend policy is unavailable.")
	var staged = CampaignWeekendTransaction.stage(
		checkpoint, restored.active_manifest, factual, policy
	)
	if not staged.ok:
		return staged
	return CampaignDirectorTransaction.after_weekend(staged.checkpoint)


static func _reject(message: String) -> Dictionary:
	return {"ok": false, "error": message}
