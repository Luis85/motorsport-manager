class_name CampaignCorrectionContracts
extends RefCounted
## Explicit provisional preview and atomic final-result correction contracts.


static func run(check: Callable) -> void:
	var loaded = ContentPackLoader.new().load_packs(["res://content/packs/core"])
	if not loaded.ok:
		check.call(false, "Correction fixture loads validated core content")
		return
	var campaign = loaded.catalog.default_campaign()
	if campaign == null:
		check.call(false, "Correction fixture resolves the authored campaign")
		return
	var track = Storage.read_json("res://data/tracks/hillside.json").data
	var record = CampaignDirectorContracts._record(track, loaded.catalog, campaign)
	if record == null:
		check.call(false, "Correction fixture creates a recorded race entry")
		return
	var checkpoint = CampaignStarter.create(
		record, campaign.to_record(), CampaignDirectorContracts._circuits(loaded.catalog, campaign)
	)
	if checkpoint.is_empty():
		check.call(false, "Correction fixture creates a campaign")
		return
	var mappings = CampaignStarter.mappings(checkpoint)
	var departed = CampaignDepartureTransaction.depart(
		checkpoint,
		CampaignStarter.next_event_context(checkpoint),
		record,
		mappings,
		CampaignStarter.event_assignments(checkpoint),
		CampaignStarter.event_cost_minor(checkpoint)
	)
	if not departed.ok:
		check.call(false, "Correction fixture departs")
		return
	var simulation: RaceSim = record.source.get_ref()
	simulation.phase = "results"
	for car in simulation.cars:
		car.dnf = false
		car.finished = true
		car.completed = simulation.laps
		car.finish_time = 900.0 + float(car.id)
		car.best_lap = 70.0 + float(car.id)
	var original_result = WeekendResult.build(record)
	var policy = CampaignStarter.weekend_policy(departed.checkpoint)
	var settled = CampaignWeekendTransaction.stage(
		departed.checkpoint, departed.manifest, original_result, policy
	)
	check.call(settled.ok, "Original final result settles before correction")
	if not settled.ok:
		return
	var followed = CampaignDirectorTransaction.after_weekend(settled.checkpoint)
	if not followed.ok:
		check.call(false, "Correction fixture publishes weekend follow-up")
		return
	checkpoint = followed.checkpoint
	var corrected = corrected_classification(original_result, checkpoint, mappings, check)
	if corrected.is_empty():
		return
	var before = RaceStateValue.fingerprint(checkpoint)
	var preview = CampaignCorrectionQuery.preview(checkpoint, departed.manifest, corrected, policy)
	check.call(
		preview.ok and preview.status == "provisional" and preview.cash_delta_minor > 0,
		"Correction preview exposes exact provisional cash delta"
	)
	check.call(
		not preview.team_point_deltas.is_empty() and not preview.driver_point_deltas.is_empty(),
		"Correction preview exposes sporting point deltas before application"
	)
	check.call(
		RaceStateValue.fingerprint(checkpoint) == before,
		"Provisional correction preview never mutates campaign authority"
	)
	var applied = CampaignWeekendTransaction.correct(
		checkpoint, departed.manifest, corrected, policy
	)
	check.call(
		applied.ok and applied.status == "corrected",
		"Explicit correction atomically replaces all event evidence"
	)
	if not applied.ok:
		return
	var changed = applied.checkpoint
	check.call(
		applied.cash_delta_minor == preview.cash_delta_minor,
		"Applied cash delta exactly matches the prior provisional preview"
	)
	check.call(
		(
			(
				changed.settlements.receipts[departed.manifest.campaign_event_id].result_digest
				== corrected.digest
			)
			and (
				changed.competition.events[departed.manifest.campaign_event_id].result_digest
				== corrected.digest
			)
			and (
				changed.economy.events[departed.manifest.campaign_event_id].result_digest
				== corrected.digest
			)
			and (
				changed.inventory.events[departed.manifest.campaign_event_id].result_digest
				== corrected.digest
			)
		),
		"Receipt, standings, cash and returned inventory share the corrected result digest"
	)
	check.call(
		changed.settlements.get("corrections", []).size() == 1,
		"Correction journal preserves old/new result evidence exactly once"
	)
	check.call(
		changed.state.clock.elapsed_slots == checkpoint.state.clock.elapsed_slots,
		"Correction never rewinds or advances authoritative campaign time"
	)
	var repeated = CampaignWeekendTransaction.correct(changed, departed.manifest, corrected, policy)
	check.call(
		(
			repeated.ok
			and repeated.status == "already_current"
			and (
				RaceStateValue.fingerprint(repeated.checkpoint)
				== RaceStateValue.fingerprint(changed)
			)
		),
		"Reapplying the same correction is an exact no-op"
	)
	check.call(
		CampaignCheckpoint.validate(changed).is_empty(),
		"Corrected campaign remains one valid cross-projection checkpoint"
	)


static func corrected_classification(
	original_result: Dictionary, checkpoint: Dictionary, mappings: Array, check: Callable
) -> Dictionary:
	var corrected = original_result.duplicate(true)
	var authored = CampaignStarter.definition(checkpoint)
	var season_id: String = authored.series.season_id
	var player_entrant_id: String = authored.player.entrant_id
	var player_race_id = -1
	for mapping in mappings:
		if (
			mapping.person_id
			in checkpoint.competition.seasons[season_id].entries[player_entrant_id].person_ids
		):
			player_race_id = int(mapping.race_id)
			break
	var player_index = -1
	for index in range(corrected.classification.size()):
		if int(corrected.classification[index].driver_id) == player_race_id:
			player_index = index
			break
	if player_index <= 0:
		check.call(false, "Correction fixture finds a player row below P1")
		return {}
	var swap = corrected.classification[0]
	corrected.classification[0] = corrected.classification[player_index]
	corrected.classification[player_index] = swap
	for index in range(corrected.classification.size()):
		corrected.classification[index].position = index + 1
	corrected.erase("digest")
	corrected["digest"] = RaceRecord.fingerprint(corrected)
	check.call(
		WeekendResult.validate(corrected).is_empty(),
		"Corrected classification remains a valid factual final result"
	)
	return corrected
