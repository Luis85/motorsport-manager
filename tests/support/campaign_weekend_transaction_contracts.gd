class_name CampaignWeekendTransactionContracts
extends RefCounted
## Atomic weekend consequence contracts executed by the registered campaign suite.

static func run(check: Callable) -> void:
	var state = _state_at_departure()
	var manifest = _manifest()
	var receipt = _receipt(manifest)
	var policy = _policy(manifest)
	var economy = CampaignEconomy.create(state.campaign_id, state.organization_id, 10000)
	var checkpoint = CampaignCheckpoint.build(state, {}, manifest, {}, economy, {})
	check.call(not checkpoint.is_empty(), "A campaign at departure can freeze one active weekend with explicit economy and empty projections")
	var before = RaceStateValue.fingerprint(checkpoint)
	var staged = CampaignWeekendTransaction.stage_receipt(checkpoint, manifest, receipt, policy)
	check.call(staged.ok and staged.status == "settled", "One validated receipt stages all weekend consequences")
	check.call(RaceStateValue.fingerprint(checkpoint) == before, "Staging weekend consequences never mutates the caller's checkpoint")
	var candidate: Dictionary = staged.checkpoint
	check.call(CampaignCheckpoint.validate(candidate).is_empty() and candidate.active_manifest.is_empty(), "Atomic candidate validates and clears the completed active weekend")
	var restored = CampaignCheckpoint.restore(candidate)
	check.call(restored.ok and restored.state.clock.elapsed_slots == manifest.return_slot, "Weekend settlement advances campaign time to the return slot exactly once")
	var season: Dictionary = restored.competition.seasons[manifest.season_id]
	check.call(season.drivers["person.00"].points == 15 and season.drivers["person.01"].points == 0,
		"Standings use explicit campaign eligibility rather than inferring points from retirement or distance")
	check.call(season.teams["team.00"].points == 15 and season.teams["team.00"].starts == 2,
		"Team standings aggregate stable person and team identities from the factual classification")
	var account: Dictionary = restored.economy.accounts[state.organization_id]
	check.call(account.cash_minor == 10200 and account.postings.size() == 3,
		"Entry cost, participation and best classified position post dated integer-minor-unit cash deltas")
	var dated = account.postings.values().all(func(posting): return posting.slot == manifest.return_slot)
	check.call(dated, "Financial consequences are dated at the frozen campaign return slot")
	check.call(restored.inventory.cars.size() == 2 and restored.inventory.cars["car.00"].health == 82.0,
		"Returned car condition and tyre identities enter campaign inventory without component diagnosis")
	check.call(not restored.inventory.events["round.1"].has("consumed"),
		"Campaign inventory does not invent consumed resources absent from the factual result envelope")
	var duplicate = CampaignWeekendTransaction.stage_receipt(candidate, manifest, receipt, policy)
	check.call(duplicate.ok and duplicate.status == "already_settled" \
		and RaceStateValue.fingerprint(duplicate.checkpoint) == RaceStateValue.fingerprint(candidate),
		"Reapplying the same receipt and policy is an exact checkpoint no-op")
	var changed_policy = CampaignWeekendPolicy.build({
		"campaign_id": manifest.campaign_id, "season_id": manifest.season_id,
		"campaign_event_id": manifest.campaign_event_id, "account_id": state.organization_id
	}, [12, 10], ["person.00"], ["person.00"], {
		"entry_cost_minor": 800, "participation_minor": 600, "position_bonus_minor": [400, 200]
	})
	var policy_conflict = CampaignWeekendTransaction.stage_receipt(candidate, manifest, receipt, changed_policy)
	check.call(not policy_conflict.ok and policy_conflict.status == "conflict" \
		and RaceStateValue.fingerprint(policy_conflict.checkpoint) == RaceStateValue.fingerprint(candidate),
		"A different valid scoring policy cannot silently reapply an already settled event")
	var changed_receipt = receipt.duplicate(true)
	changed_receipt.result_digest = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
	changed_receipt.erase("digest"); changed_receipt["digest"] = RaceStateValue.fingerprint(changed_receipt)
	var receipt_conflict = CampaignWeekendTransaction.stage_receipt(candidate, manifest, changed_receipt, policy)
	check.call(not receipt_conflict.ok and receipt_conflict.status == "conflict" \
		and RaceStateValue.fingerprint(receipt_conflict.checkpoint) == RaceStateValue.fingerprint(candidate),
		"A different factual result requires correction instead of duplicate time, points, stock or money")
	var invalid_receipt = receipt.duplicate(true)
	invalid_receipt.returned_resources[0].tyres = []
	for index in range(CampaignInventory.MAX_TYRE_SETS + 1):
		invalid_receipt.returned_resources[0].tyres.append({"id": "set.%02d" % index})
	invalid_receipt.erase("digest"); invalid_receipt["digest"] = RaceStateValue.fingerprint(invalid_receipt)
	var inventory_rejection = CampaignWeekendTransaction.stage_receipt(checkpoint, manifest, invalid_receipt, policy)
	check.call(not inventory_rejection.ok and RaceStateValue.fingerprint(inventory_rejection.checkpoint) == before,
		"Invalid returned inventory rejects the whole transaction before time, standings or cash can publish")
	var drifted_state = _state_at_departure()
	drifted_state.command("advance_slots", {"slots": 1})
	var drifted = CampaignCheckpoint.build(drifted_state, {}, manifest, {},
		CampaignEconomy.create(drifted_state.campaign_id, drifted_state.organization_id, 10000), {})
	var time_rejection = CampaignWeekendTransaction.stage_receipt(drifted, manifest, receipt, policy)
	check.call(not time_rejection.ok and RaceStateValue.fingerprint(time_rejection.checkpoint) == RaceStateValue.fingerprint(drifted),
		"Weekend consequences reject campaign time that no longer equals the frozen departure boundary")
	var files = CampaignStorageContracts.MemoryFiles.new()
	var storage = CampaignStorage.new("user://campaign-weekend-transaction.json", files)
	check.call(storage.save_checkpoint(candidate).is_empty(), "Atomic storage accepts the complete consequence checkpoint")
	var loaded = storage.load()
	check.call(loaded.ok and loaded.state.clock.elapsed_slots == manifest.return_slot \
		and loaded.economy.accounts[state.organization_id].cash_minor == 10200 \
		and loaded.competition.events.has(manifest.campaign_event_id),
		"Saved campaign restore preserves time, standings, inventory, ledger and exactly-once receipt together")
	var legacy = {
		"kind": CampaignCheckpoint.KIND,
		"version": CampaignCheckpoint.LEGACY_VERSION,
		"campaign_id": state.campaign_id,
		"state": state.snapshot(),
		"settlements": CampaignWeekendSettlement.empty_ledger(),
		"active_manifest": {}
	}
	legacy["digest"] = RaceStateValue.fingerprint(legacy)
	var migrated = CampaignCheckpoint.restore(legacy)
	check.call(migrated.ok and migrated.checkpoint.version == CampaignCheckpoint.VERSION \
		and migrated.competition.events.is_empty() and migrated.inventory.events.is_empty(),
		"Version-one campaign checkpoints migrate deterministically without fabricated consequences")

static func _state_at_departure() -> CampaignState:
	var state = CampaignState.create({
		"campaign_id": "career.test",
		"organization_id": "organization.test",
		"principal_id": "person.principal",
		"start": {"year": 1950, "month": 1, "day": 1, "slot": 0}
	})
	state.command("advance_slots", {"slots": 100})
	return state

static func _manifest() -> Dictionary:
	var data = {
		"kind": CampaignWeekendManifest.KIND,
		"version": CampaignWeekendManifest.VERSION,
		"campaign_id": "career.test",
		"season_id": "season.1",
		"campaign_event_id": "round.1",
		"entrant_id": "entrant.player",
		"event_revision": 1,
		"departure_slot": 100,
		"return_slot": 140,
		"race_event_id": "11111111-1111-4111-8111-111111111111",
		"race_model": "practice-race-sim",
		"checkpoint_version": 11,
		"track_hash": "1111111111111111111111111111111111111111111111111111111111111111",
		"roster_hash": "2222222222222222222222222222222222222222222222222222222222222222",
		"starting_resources_hash": "3333333333333333333333333333333333333333333333333333333333333333",
		"ruleset_hash": "4444444444444444444444444444444444444444444444444444444444444444",
		"mappings": [
			{"race_id": 0, "person_id": "person.00", "team_id": "team.00", "car_id": "car.00"},
			{"race_id": 1, "person_id": "person.01", "team_id": "team.00", "car_id": "car.01"}
		]
	}
	data["digest"] = RaceStateValue.fingerprint(data)
	return data

static func _receipt(manifest: Dictionary) -> Dictionary:
	var data = {
		"kind": CampaignWeekendSettlement.RECEIPT_KIND,
		"version": CampaignWeekendSettlement.VERSION,
		"campaign_id": manifest.campaign_id,
		"season_id": manifest.season_id,
		"campaign_event_id": manifest.campaign_event_id,
		"entrant_id": manifest.entrant_id,
		"race_event_id": manifest.race_event_id,
		"manifest_digest": manifest.digest,
		"result_digest": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		"classification": [
			{"position": 1, "person_id": "person.00", "team_id": "team.00", "car_id": "car.00",
				"status": "Finished", "laps": 12, "finish_time": 900.0, "best_lap": 70.0,
				"points_eligibility": "not_defined_by_standalone_rules", "classified": true},
			{"position": 2, "person_id": "person.01", "team_id": "team.00", "car_id": "car.01",
				"status": "Retired", "laps": 10, "finish_time": 0.0, "best_lap": 71.0,
				"points_eligibility": "not_defined_by_standalone_rules", "classified": false}
		],
		"returned_resources": [
			{"person_id": "person.00", "team_id": "team.00", "car_id": "car.00",
				"health": 82.0, "damage": 18.0, "tyres": [{"id": "set.00", "life": 54.0}]},
			{"person_id": "person.01", "team_id": "team.00", "car_id": "car.01",
				"health": 61.0, "damage": 39.0, "tyres": [{"id": "set.01", "life": 21.0}]}
		],
		"statistics": {"passes": 3, "incidents": 1, "pits": 2, "blue_flags": 0},
		"provenance": "Synthetic factual receipt for atomic campaign consequence contracts."
	}
	data["digest"] = RaceStateValue.fingerprint(data)
	return data

static func _policy(manifest: Dictionary) -> Dictionary:
	return CampaignWeekendPolicy.build({
		"campaign_id": manifest.campaign_id,
		"season_id": manifest.season_id,
		"campaign_event_id": manifest.campaign_event_id,
		"account_id": "organization.test"
	}, [15, 12], ["person.00"], ["person.00"], {
		"entry_cost_minor": 800,
		"participation_minor": 600,
		"position_bonus_minor": [400, 200]
	})
