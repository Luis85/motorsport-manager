extends RefCounted
## Atomic weekend consequence contracts executed by the registered campaign suite.


static func _state_at_departure() -> CampaignState:
	var state = CampaignState.create(
		{
			"campaign_id": "career.test",
			"organization_id": "organization.test",
			"principal_id": "person.principal",
			"start": {"year": 1950, "month": 1, "day": 1, "slot": 0}
		}
	)
	state.command("advance_slots", {"slots": 100})
	return state


static func _competition(manifest: Dictionary, policy: Dictionary) -> Dictionary:
	var rules = CampaignSeriesRules.build(
		{
			"series_id": "series.test",
			"name": "Test Championship",
			"cars_per_entrant": 2,
			"min_entrants": 1,
			"max_entrants": 1,
			"min_events": 1,
			"max_events": 1,
			"points_by_position": policy.points_by_position,
			"countback_depth": 2
		}
	)
	var competition = CampaignCompetition.empty(manifest.campaign_id)
	var changed = CampaignCompetition.register_series(competition, rules)
	if not changed.ok:
		return {}
	competition = changed.competition
	changed = CampaignCompetition.create_season(
		competition,
		{
			"season_id": manifest.season_id,
			"series_id": rules.series_id,
			"calendar":
			[
				{
					"campaign_event_id": manifest.campaign_event_id,
					"round": 1,
					"departure_slot": manifest.departure_slot,
					"return_slot": manifest.return_slot,
					"event_revision": manifest.event_revision,
					"track_hash": manifest.track_hash,
					"ruleset_hash": manifest.ruleset_hash
				}
			]
		}
	)
	if not changed.ok:
		return {}
	competition = changed.competition
	changed = CampaignCompetition.transition_season(competition, manifest.season_id, "entries_open")
	if not changed.ok:
		return {}
	competition = changed.competition
	changed = CampaignCompetition.submit_entry(
		competition,
		manifest.season_id,
		{
			"entrant_id": manifest.entrant_id,
			"team_id": "team.00",
			"person_ids": ["person.00", "person.01"],
			"car_ids": ["car.00", "car.01"]
		}
	)
	if not changed.ok:
		return {}
	competition = changed.competition
	changed = CampaignCompetition.decide_entry(
		competition, manifest.season_id, manifest.entrant_id, true
	)
	if not changed.ok:
		return {}
	competition = changed.competition
	for target in ["preseason", "active"]:
		changed = CampaignCompetition.transition_season(competition, manifest.season_id, target)
		if not changed.ok:
			return {}
		competition = changed.competition
	return competition


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
		"race_event_id": "11111111111141118111111111111111",
		"race_model": "practice-race-sim",
		"checkpoint_version": 11,
		"track_hash": "1111111111111111111111111111111111111111111111111111111111111111",
		"roster_hash": "2222222222222222222222222222222222222222222222222222222222222222",
		"starting_resources_hash":
		"3333333333333333333333333333333333333333333333333333333333333333",
		"ruleset_hash": "4444444444444444444444444444444444444444444444444444444444444444",
		"mappings":
		[
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
		"classification":
		[
			{
				"position": 1,
				"person_id": "person.00",
				"team_id": "team.00",
				"car_id": "car.00",
				"status": "finished",
				"laps": 12,
				"finish_time": 900.0,
				"name": "Person 00",
				"team": "Team 00",
				"points_eligibility": "not_defined_by_standalone_rules"
			},
			{
				"position": 2,
				"person_id": "person.01",
				"team_id": "team.00",
				"car_id": "car.01",
				"status": "retired",
				"laps": 10,
				"finish_time": 0.0,
				"name": "Person 01",
				"team": "Team 00",
				"points_eligibility": "not_defined_by_standalone_rules"
			}
		],
		"returned_resources":
		[
			{
				"person_id": "person.00",
				"team_id": "team.00",
				"car_id": "car.00",
				"health": 82.0,
				"damage": 18.0,
				"tyres": [{"id": "set.00", "life": 54.0}]
			},
			{
				"person_id": "person.01",
				"team_id": "team.00",
				"car_id": "car.01",
				"health": 61.0,
				"damage": 39.0,
				"tyres": [{"id": "set.01", "life": 21.0}]
			}
		],
		"statistics": {"passes": 3, "incidents": 1, "pits": 2, "blue_flags": 0},
		"provenance": "Synthetic factual receipt for atomic campaign consequence contracts."
	}
	data["digest"] = RaceStateValue.fingerprint(data)
	return data


static func _policy(manifest: Dictionary) -> Dictionary:
	return CampaignWeekendPolicy.build(
		{
			"campaign_id": manifest.campaign_id,
			"season_id": manifest.season_id,
			"campaign_event_id": manifest.campaign_event_id,
			"account_id": "organization.test"
		},
		[15, 12],
		["person.00"],
		["person.00"],
		{"entry_cost_minor": 800, "participation_minor": 600, "position_bonus_minor": [400, 200]}
	)
