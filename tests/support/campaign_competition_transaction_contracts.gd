class_name CampaignCompetitionTransactionContracts
extends RefCounted
## Application-level publication and persistence contracts for TM-03 administration.

static func run(check: Callable) -> void:
	var state = CampaignState.create({
		"campaign_id": "career.competition-tx",
		"organization_id": "organization.competition-tx",
		"principal_id": "person.principal",
		"start": {"year": 1950, "month": 1, "day": 1, "slot": 0}
	})
	var checkpoint = CampaignCheckpoint.build(state)
	check.call(not checkpoint.is_empty(), "A fresh campaign checkpoint can host explicit competition administration")
	var original = RaceStateValue.fingerprint(checkpoint)
	var changed = CampaignCompetitionTransaction.register_series(checkpoint, _rules())
	check.call(changed.ok and changed.status == "registered",
		"Series registration publishes one complete candidate checkpoint")
	check.call(RaceStateValue.fingerprint(checkpoint) == original,
		"Competition administration never mutates the caller checkpoint")
	checkpoint = changed.checkpoint
	var duplicate = CampaignCompetitionTransaction.register_series(checkpoint, _rules())
	check.call(not duplicate.ok and RaceStateValue.fingerprint(duplicate.checkpoint) == RaceStateValue.fingerprint(checkpoint),
		"Rejected duplicate series registration leaves every campaign projection unchanged")
	changed = CampaignCompetitionTransaction.create_season(checkpoint, _season())
	check.call(changed.ok and changed.status == "created", "Season creation is published through the checkpoint boundary")
	checkpoint = changed.checkpoint
	changed = CampaignCompetitionTransaction.transition_season(checkpoint, "season.tx", "entries_open")
	check.call(changed.ok, "Atomic competition administration opens entries")
	checkpoint = changed.checkpoint
	changed = CampaignCompetitionTransaction.submit_entry(checkpoint, "season.tx", _entry())
	check.call(changed.ok and changed.status == "submitted", "Atomic competition administration submits a stable entry")
	checkpoint = changed.checkpoint
	changed = CampaignCompetitionTransaction.decide_entry(checkpoint, "season.tx", "entrant.tx", true)
	check.call(changed.ok and changed.status == "accepted", "Atomic competition administration accepts the entry")
	checkpoint = changed.checkpoint
	for target in ["preseason", "active"]:
		changed = CampaignCompetitionTransaction.transition_season(checkpoint, "season.tx", target)
		check.call(changed.ok, "Atomic competition administration reaches " + target)
		checkpoint = changed.checkpoint
	var restored = CampaignCheckpoint.restore(checkpoint)
	check.call(restored.ok and restored.competition.seasons["season.tx"].status == "active" \
		and restored.economy.accounts[state.organization_id].cash_minor == 0,
		"Competition publication preserves campaign state, economy and the active season together")
	var files = CampaignStorageContracts.MemoryFiles.new()
	var storage = CampaignStorage.new("user://campaign-competition-transaction.json", files)
	check.call(storage.save_checkpoint(checkpoint).is_empty(),
		"Campaign storage accepts a complete active-season checkpoint")
	var loaded = storage.load()
	check.call(loaded.ok and loaded.competition.seasons["season.tx"].entries["entrant.tx"].status == "accepted",
		"Save and restore preserve rule pack, calendar, entries and lifecycle state")
	var active_checkpoint = CampaignCheckpoint.build(
		restored.state,
		restored.settlements,
		_manifest(),
		restored.competition,
		restored.economy,
		restored.inventory
	)
	check.call(not active_checkpoint.is_empty(), "The registered next event can be frozen as an active campaign manifest")
	var frozen = RaceStateValue.fingerprint(active_checkpoint)
	var blocked = CampaignCompetitionTransaction.cancel_event(active_checkpoint, "season.tx", "event.tx", "Unavailable circuit.")
	check.call(not blocked.ok and RaceStateValue.fingerprint(blocked.checkpoint) == frozen,
		"Competition administration is frozen while the weekend manifest is active")
	changed = CampaignCompetitionTransaction.cancel_event(checkpoint, "season.tx", "event.tx", "Unavailable circuit.")
	check.call(changed.ok and changed.checkpoint.competition.seasons["season.tx"].calendar[0].status == "cancelled" \
		and changed.checkpoint.competition.events.is_empty(),
		"An explicit pre-departure cancellation records no sporting result or financial consequence")

static func _rules() -> Dictionary:
	return CampaignSeriesRules.build({
		"series_id": "series.tx",
		"name": "Transaction Test Series",
		"cars_per_entrant": 2,
		"min_entrants": 1,
		"max_entrants": 1,
		"min_events": 1,
		"max_events": 1,
		"points_by_position": [15, 12],
		"countback_depth": 2
	})

static func _season() -> Dictionary:
	return {
		"season_id": "season.tx",
		"series_id": "series.tx",
		"calendar": [{
			"campaign_event_id": "event.tx",
			"round": 1,
			"departure_slot": 0,
			"return_slot": 40,
			"event_revision": 1,
			"track_hash": "1111111111111111111111111111111111111111111111111111111111111111",
			"ruleset_hash": "2222222222222222222222222222222222222222222222222222222222222222"
		}]
	}

static func _entry() -> Dictionary:
	return {
		"entrant_id": "entrant.tx",
		"team_id": "team.tx",
		"person_ids": ["person.tx0", "person.tx1"],
		"car_ids": ["car.tx0", "car.tx1"]
	}

static func _manifest() -> Dictionary:
	var data = {
		"kind": CampaignWeekendManifest.KIND,
		"version": CampaignWeekendManifest.VERSION,
		"campaign_id": "career.competition-tx",
		"season_id": "season.tx",
		"campaign_event_id": "event.tx",
		"entrant_id": "entrant.tx",
		"event_revision": 1,
		"departure_slot": 0,
		"return_slot": 40,
		"race_event_id": "11111111-1111-4111-8111-111111111111",
		"race_model": "practice-race-sim",
		"checkpoint_version": 11,
		"track_hash": "1111111111111111111111111111111111111111111111111111111111111111",
		"roster_hash": "3333333333333333333333333333333333333333333333333333333333333333",
		"starting_resources_hash": "4444444444444444444444444444444444444444444444444444444444444444",
		"ruleset_hash": "2222222222222222222222222222222222222222222222222222222222222222",
		"mappings": [
			{"race_id": 0, "person_id": "person.tx0", "team_id": "team.tx", "car_id": "car.tx0"},
			{"race_id": 1, "person_id": "person.tx1", "team_id": "team.tx", "car_id": "car.tx1"}
		]
	}
	data["digest"] = RaceStateValue.fingerprint(data)
	return data
