class_name CampaignCompetitionIdentityContracts
extends RefCounted
## Stable campaign event identities are global across series and seasons.

static func run(check: Callable) -> void:
	var competition = CampaignCompetition.empty("career.identity-test")
	var rules_a = _rules("series.a")
	var rules_b = _rules("series.b")
	for rules in [rules_a, rules_b]:
		var registered = CampaignCompetition.register_series(competition, rules)
		check.call(registered.ok, "Independent series rule pack registers for event-identity coverage")
		if not registered.ok:
			return
		competition = registered.competition
	var created = CampaignCompetition.create_season(competition,
		_season("season.a", "series.a", "event.shared"))
	check.call(created.ok, "The first globally stable campaign event identity is accepted")
	if not created.ok:
		return
	competition = created.competition
	var before = RaceStateValue.fingerprint(competition)
	var duplicate = CampaignCompetition.create_season(competition,
		_season("season.b", "series.b", "event.shared"))
	check.call(not duplicate.ok and RaceStateValue.fingerprint(duplicate.competition) == before,
		"A second season cannot reuse an existing campaign event identity")
	var tampered = competition.duplicate(true)
	tampered.seasons["season.b"] = CampaignSeason.build(
		_season("season.b", "series.b", "event.shared"), rules_b)
	tampered.erase("digest")
	tampered["digest"] = RaceStateValue.fingerprint(tampered)
	check.call(not CampaignCompetition.validate(tampered).is_empty(),
		"Recomputed outer integrity cannot conceal duplicate calendar identities")

static func _rules(series_id: String) -> Dictionary:
	return CampaignSeriesRules.build({
		"series_id": series_id,
		"name": "Identity Test " + series_id,
		"cars_per_entrant": 1,
		"min_entrants": 1,
		"max_entrants": 1,
		"min_events": 1,
		"max_events": 1,
		"points_by_position": [10],
		"countback_depth": 1
	})

static func _season(season_id: String, series_id: String, event_id: String) -> Dictionary:
	return {
		"season_id": season_id,
		"series_id": series_id,
		"calendar": [{
			"campaign_event_id": event_id,
			"round": 1,
			"departure_slot": 10,
			"return_slot": 20,
			"event_revision": 1,
			"track_hash": "1111111111111111111111111111111111111111111111111111111111111111",
			"ruleset_hash": "2222222222222222222222222222222222222222222222222222222222222222"
		}]
	}
