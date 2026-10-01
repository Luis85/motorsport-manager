class_name CampaignRivalContracts
extends RefCounted
## TM-12 finite rival budgets, accepted rosters and dated project-cycle contracts.
const DAY = CampaignClock.SLOTS_PER_DAY

static func run(check: Callable) -> void:
	var checkpoint = _fixture()
	check.call(not checkpoint.is_empty(), "TM-12 fixture creates an active two-team season")
	if checkpoint.is_empty(): return
	var before = RaceStateValue.fingerprint(checkpoint)
	var registered = CampaignRivalTransaction.register_team(checkpoint, {
		"team_id": "team.rival", "entrant_id": "entrant.rival",
		"person_ids": ["person.rival.0", "person.rival.1"],
		"car_ids": ["car.rival.0", "car.rival.1"],
		"archetype": "reliability", "cash_minor": 40000,
		"reserve_minor": 20000, "capability_bps": 10000,
		"next_review_slot": 0, "review_interval_slots": 7 * DAY
	})
	check.call(registered.ok and RaceStateValue.fingerprint(checkpoint) == before,
		"Accepted rival roster can register without mutating the caller checkpoint")
	if not registered.ok: return
	checkpoint = registered.checkpoint
	var reviewed = CampaignRivalTransaction.review_due(checkpoint)
	check.call(reviewed.ok and reviewed.reviewed == 1,
		"Due rival performs one deterministic organization review")
	if not reviewed.ok: return
	checkpoint = reviewed.checkpoint
	var rival: Dictionary = checkpoint.management.rivals.teams["team.rival"]
	check.call(rival.project == "reliability" and rival.committed_minor == 6000 		and rival.cash_minor == 40000,
		"Reliability rival reserves a bounded project without fabricating cash")
	check.call(rival.committed_minor <= rival.cash_minor - rival.reserve_minor,
		"Rival project never breaches its explicit liquidity reserve")
	var cycle: Dictionary = checkpoint.management.rivals.decision_cycles[0]
	check.call(cycle.information_scope == "own organization + public championship standings",
		"Rival decision evidence records the public-only information boundary")
	var advanced = _advance(checkpoint, 7 * DAY)
	check.call(not advanced.is_empty(), "Campaign time can advance to the next rival review boundary")
	if advanced.is_empty(): return
	var second = CampaignRivalTransaction.review_due(advanced)
	check.call(second.ok and second.reviewed == 1, "Second rival review settles prior work and creates the next bounded plan")
	if not second.ok: return
	var next: Dictionary = second.checkpoint.management.rivals.teams["team.rival"]
	check.call(next.cash_minor == 34000 and next.capability_bps > 10000 		and next.committed_minor <= next.cash_minor - next.reserve_minor,
		"Completed rival project consumes real cash before capability improves")
	var bad = second.checkpoint.duplicate(true)
	bad.management.rivals.teams["team.rival"].person_ids[0] = "person.player.0"
	_reseal(bad.management.rivals.teams["team.rival"])
	_reseal(bad.management)
	_reseal(bad)
	check.call(not CampaignCheckpoint.validate(bad).is_empty(),
		"Recomputed digests cannot remap a rival roster away from its accepted season entry")

static func _fixture() -> Dictionary:
	var state = CampaignState.create({"campaign_id": "career.rivals",
		"organization_id": "organization.player", "principal_id": "person.principal",
		"start": {"year": 1950, "month": 1, "day": 1, "slot": 0}})
	var checkpoint = CampaignCheckpoint.build(state, {}, {}, {},
		CampaignEconomy.create(state.campaign_id, state.organization_id, 100000, 0), {})
	var rules = CampaignSeriesRules.build({"series_id": "series.rivals", "name": "Rival Test",
		"cars_per_entrant": 2, "min_entrants": 2, "max_entrants": 2,
		"min_events": 1, "max_events": 1, "points_by_position": [15, 12, 10, 8],
		"countback_depth": 4})
	var changed = CampaignCompetitionTransaction.register_series(checkpoint, rules)
	if not changed.ok: return {}
	checkpoint = changed.checkpoint
	changed = CampaignCompetitionTransaction.create_season(checkpoint, {
		"season_id": "season.rivals", "series_id": "series.rivals",
		"calendar": [{"campaign_event_id": "event.rivals.1", "round": 1,
			"departure_slot": 0, "return_slot": 40, "event_revision": 1,
			"track_hash": "1111111111111111111111111111111111111111111111111111111111111111",
			"ruleset_hash": "2222222222222222222222222222222222222222222222222222222222222222"}]})
	if not changed.ok: return {}
	checkpoint = changed.checkpoint
	changed = CampaignCompetitionTransaction.transition_season(checkpoint, "season.rivals", "entries_open")
	if not changed.ok: return {}
	checkpoint = changed.checkpoint
	for entry in [
		{"entrant_id": "entrant.player", "team_id": "team.player",
			"person_ids": ["person.player.0", "person.player.1"],
			"car_ids": ["car.player.0", "car.player.1"]},
		{"entrant_id": "entrant.rival", "team_id": "team.rival",
			"person_ids": ["person.rival.0", "person.rival.1"],
			"car_ids": ["car.rival.0", "car.rival.1"]}
	]:
		changed = CampaignCompetitionTransaction.submit_entry(checkpoint, "season.rivals", entry)
		if not changed.ok: return {}
		checkpoint = changed.checkpoint
		changed = CampaignCompetitionTransaction.decide_entry(
			checkpoint, "season.rivals", entry.entrant_id, true)
		if not changed.ok: return {}
		checkpoint = changed.checkpoint
	for target in ["preseason", "active"]:
		changed = CampaignCompetitionTransaction.transition_season(checkpoint, "season.rivals", target)
		if not changed.ok: return {}
		checkpoint = changed.checkpoint
	return checkpoint

static func _advance(checkpoint: Dictionary, slots: int) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok or not restored.state.command("advance_slots", {"slots": slots}): return {}
	return CampaignCheckpoint.build(restored.state, restored.settlements, restored.active_manifest,
		restored.competition, restored.economy, restored.inventory, restored.personnel,
		restored.operations, restored.engineering, restored.management)

static func _reseal(data: Dictionary) -> void:
	data.erase("digest"); data["digest"] = RaceStateValue.fingerprint(data)
