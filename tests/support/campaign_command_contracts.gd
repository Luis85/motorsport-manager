class_name CampaignCommandContracts
extends RefCounted

static func state() -> CampaignState:
	return CampaignState.create({
		"campaign_id": "career.obsidian",
		"organization_id": "organization.obsidian-works",
		"principal_id": "person.founder",
		"start": {"year": 1950, "month": 12, "day": 31, "slot": 92},
		"energy_capacity": 6
	})

static func run(check: Callable) -> void:
	var campaign = state()
	check.call(campaign != null and CampaignState.validate(campaign.snapshot()).is_empty(), "Campaign state starts as a valid deterministic aggregate")
	var commands = CampaignCommands.new(campaign)
	var untouched = RaceStateValue.fingerprint(campaign.snapshot())
	check.call(not commands.execute("advance_slots", {"slots": 0}) and RaceStateValue.fingerprint(campaign.snapshot()) == untouched, "Rejected campaign advance leaves state, energy and history unchanged")
	check.call(not commands.execute("intervention", {"id": "bad path", "energy": 1, "duration_slots": 1}) and RaceStateValue.fingerprint(campaign.snapshot()) == untouched, "Rejected campaign intervention leaves the aggregate unchanged")
	check.call(commands.execute("intervention", {"id": "intervention.year-end", "energy": 1, "duration_slots": 4}), "A valid principal intervention is accepted explicitly")
	check.call(campaign.energy_available == 5 and campaign.founder_busy_until_slot == 4, "Accepted intervention consumes energy and reserves principal time")
	var committed = RaceStateValue.fingerprint(campaign.snapshot())
	check.call(not commands.execute("intervention", {"id": "intervention.overlap", "energy": 1, "duration_slots": 1}) and RaceStateValue.fingerprint(campaign.snapshot()) == committed, "Overlapping intervention is rejected without partial energy consumption")
	check.call(not commands.execute("intervention", {"id": "intervention.year-end", "energy": 1, "duration_slots": 4}) and RaceStateValue.fingerprint(campaign.snapshot()) == committed, "Duplicate intervention identity is an idempotent rejection")
	check.call(commands.execute("advance_slots", {"slots": 4}), "Explicit advance reaches the next day boundary")
	check.call(campaign.clock.day_key() == "1951-01-01" and campaign.clock.slot_of_day == 0 and campaign.energy_available == 6, "Next day boundary replenishes, but does not carry over, intervention energy")
	for row in [
		{"id": "intervention.test", "energy": 2, "duration_slots": 2},
		{"id": "intervention.review", "energy": 2, "duration_slots": 2},
		{"id": "intervention.decision", "energy": 2, "duration_slots": 2}
	]:
		check.call(commands.execute("intervention", row), "Scheduled intervention consumes its declared bounded energy")
		check.call(commands.execute("advance_slots", {"slots": 2}), "Explicit time advance releases the principal for the next intervention")
	check.call(campaign.energy_available == 0, "Three two-point interventions exhaust the six-point day exactly")
	var exhausted = RaceStateValue.fingerprint(campaign.snapshot())
	check.call(not commands.execute("intervention", {"id": "intervention.unfunded", "energy": 1, "duration_slots": 1}) and RaceStateValue.fingerprint(campaign.snapshot()) == exhausted, "Zero energy rejects another intervention without corrupting state")
	check.call(commands.execute("advance_slots", {"slots": 90}) and campaign.clock.day_key() == "1951-01-02" and campaign.energy_available == 6, "A later day boundary restores energy after deterministic fast-forward")
	var snapshot = campaign.snapshot()
	var restored = CampaignState.restore(snapshot)
	check.call(restored != null and restored.snapshot() == snapshot, "Accepted campaign command history restores the exact state")
	var replayed = state()
	for row in snapshot.commands:
		check.call(replayed.command(row.action, row.payload), "Recorded campaign command replays through the production validator")
	check.call(replayed.snapshot() == snapshot, "The same command history produces the same campaign state")
	var detached = campaign.snapshot(); detached.energy_available = 1; detached.commands.clear()
	check.call(campaign.energy_available == 6 and campaign.commands.size() == snapshot.commands.size(), "Campaign snapshots are detached from authoritative energy and history")
	var tampered = snapshot.duplicate(true)
	tampered.commands[0].payload.energy = 2
	tampered.erase("digest"); tampered["digest"] = RaceStateValue.fingerprint(tampered)
	check.call(not CampaignState.validate(tampered).is_empty(), "A recomputed outer digest cannot conceal command-history divergence")
	var ephemeral = state()
	var expired = CampaignCommands.new(ephemeral)
	ephemeral = null
	check.call(not expired.execute("advance_slots", {"slots": 1}) and not expired.last_error.is_empty(), "A retained campaign command handle cannot keep discarded state alive")
