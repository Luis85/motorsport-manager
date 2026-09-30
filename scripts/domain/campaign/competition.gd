class_name CampaignCompetition
extends RefCounted
## Versioned competition authority: rule packs, season calendars, entries,
## immutable event awards, countback standings and lifecycle transitions.
const KIND = "motorsport-manager-campaign-competition"
const VERSION = 2
const LEGACY_VERSION = 1
const MAX_EVENTS = 1024
const MAX_SERIES = 32
const MAX_SEASONS = 64
const MAX_POINTS = 1000000000

static func empty(campaign_id: String) -> Dictionary:
	if not CampaignIdentity.valid(campaign_id):
		return {}
	var data = {
		"kind": KIND,
		"version": VERSION,
		"campaign_id": campaign_id,
		"series": {},
		"seasons": {},
		"events": {}
	}
	_seal(data)
	return data

static func register_series(current: Dictionary, rules: Dictionary) -> Dictionary:
	var writable = _writable(current)
	if not writable.ok:
		return _reject(writable.error, current)
	var data: Dictionary = writable.competition
	var error = CampaignSeriesRules.validate(rules)
	if not error.is_empty():
		return _reject(error, current)
	if data.series.has(rules.series_id) or data.series.size() >= MAX_SERIES:
		return _reject("Campaign series identity already exists or the registry is full.", current)
	data.series[rules.series_id] = rules.duplicate(true)
	_seal(data)
	error = validate(data)
	return _result(error, "registered", data, current)

static func create_season(current: Dictionary, definition: Dictionary) -> Dictionary:
	var writable = _writable(current)
	if not writable.ok:
		return _reject(writable.error, current)
	var data: Dictionary = writable.competition
	var season_id = definition.get("season_id")
	var series_id = definition.get("series_id")
	if not CampaignIdentity.valid(season_id) or data.seasons.has(season_id) or data.seasons.size() >= MAX_SEASONS:
		return _reject("Campaign season identity already exists or the registry is full.", current)
	if not CampaignIdentity.valid(series_id) or not data.series.has(series_id):
		return _reject("Campaign season references an unknown series.", current)
	for existing in data.seasons.values():
		if existing.series_id == series_id and existing.status != "completed":
			return _reject("A new season cannot open before the prior series season completes its transition.", current)
	var season = CampaignSeason.build(definition, data.series[series_id])
	if season.is_empty():
		return _reject("Campaign season definition is invalid.", current)
	var event_ids = {}
	for existing in data.seasons.values():
		for item in existing.calendar:
			event_ids[item.campaign_event_id] = true
	for item in season.calendar:
		if event_ids.has(item.campaign_event_id):
			return _reject("Campaign event identities must remain unique across every season.", current)
	data.seasons[season_id] = season
	_seal(data)
	return _result(validate(data), "created", data, current)

static func transition_season(current: Dictionary, season_id: String, target: String) -> Dictionary:
	var context = _season_context(current, season_id)
	if not context.ok:
		return _reject(context.error, current)
	var changed = CampaignSeason.transition(context.season, target, context.rules, context.competition.events)
	return _publish_season(context.competition, season_id, changed, current)

static func submit_entry(current: Dictionary, season_id: String, entry: Dictionary) -> Dictionary:
	var context = _season_context(current, season_id)
	if not context.ok:
		return _reject(context.error, current)
	var changed = CampaignSeason.submit_entry(context.season, entry, context.rules, context.competition.events)
	return _publish_season(context.competition, season_id, changed, current)

static func decide_entry(current: Dictionary, season_id: String, entrant_id: String, accept: bool) -> Dictionary:
	var context = _season_context(current, season_id)
	if not context.ok:
		return _reject(context.error, current)
	var changed = CampaignSeason.decide_entry(context.season, entrant_id, accept, context.rules, context.competition.events)
	return _publish_season(context.competition, season_id, changed, current)

static func withdraw_entry(current: Dictionary, season_id: String, entrant_id: String) -> Dictionary:
	var context = _season_context(current, season_id)
	if not context.ok:
		return _reject(context.error, current)
	var changed = CampaignSeason.withdraw_entry(context.season, entrant_id, context.rules, context.competition.events)
	return _publish_season(context.competition, season_id, changed, current)

static func cancel_event(current: Dictionary, season_id: String, event_id: String, reason: String) -> Dictionary:
	var context = _season_context(current, season_id)
	if not context.ok:
		return _reject(context.error, current)
	var changed = CampaignSeason.cancel_next_event(context.season, event_id, reason,
		context.rules, context.competition.events)
	return _publish_season(context.competition, season_id, changed, current)

static func manifest_error(current: Dictionary, manifest: Dictionary) -> String:
	var error = validate(current)
	if not error.is_empty():
		return error
	if int(current.version) != VERSION:
		return "Legacy competition history cannot launch a new versioned season weekend."
	if manifest.get("campaign_id") != current.campaign_id:
		return "Campaign weekend belongs to another competition."
	var season_id = manifest.get("season_id")
	if not current.seasons.has(season_id):
		return "Campaign weekend references an unknown season."
	var season: Dictionary = current.seasons[season_id]
	var rules: Dictionary = current.series[season.series_id]
	return CampaignSeason.manifest_error(season, manifest, rules, current.events)

static func stage(current: Dictionary, receipt: Dictionary, policy: Dictionary) -> Dictionary:
	var data = empty(receipt.get("campaign_id", "")) if current.is_empty() else current.duplicate(true)
	var error = validate(data)
	if not error.is_empty():
		return {"ok": false, "status": "rejected", "error": error, "competition": current.duplicate(true)}
	error = CampaignWeekendPolicy.receipt_error(policy, receipt)
	if not error.is_empty():
		return {"ok": false, "status": "rejected", "error": error, "competition": current.duplicate(true)}
	if data.campaign_id != receipt.campaign_id:
		return {"ok": false, "status": "rejected", "error": "Competition projection belongs to another campaign.",
			"competition": current.duplicate(true)}
	var event_id: String = receipt.campaign_event_id
	if data.events.has(event_id):
		var previous: Dictionary = data.events[event_id]
		if previous.result_digest == receipt.result_digest and previous.policy_digest == policy.digest:
			return {"ok": true, "status": "already_applied", "error": "", "competition": data}
		return {"ok": false, "status": "conflict",
			"error": "Competition consequences already exist for this event under different evidence or rules.",
			"competition": current.duplicate(true)}
	if int(data.version) == LEGACY_VERSION:
		if not data.events.is_empty() or not data.seasons.is_empty():
			return {"ok": false, "status": "rejected",
				"error": "Legacy sporting history is read-only until an explicit calendar migration is supplied.",
				"competition": current.duplicate(true)}
		data = empty(data.campaign_id)
	if data.events.size() >= MAX_EVENTS:
		return {"ok": false, "status": "rejected", "error": "Competition event history is full.",
			"competition": current.duplicate(true)}
	if not data.seasons.has(receipt.season_id):
		return {"ok": false, "status": "rejected", "error": "Competition result references an unknown season.",
			"competition": current.duplicate(true)}
	var season: Dictionary = data.seasons[receipt.season_id]
	var rules: Dictionary = data.series[season.series_id]
	error = CampaignSeason.result_error(season, receipt, policy, rules, data.events)
	if not error.is_empty():
		return {"ok": false, "status": "rejected", "error": error, "competition": current.duplicate(true)}
	var scheduled = CampaignSeason.calendar_event(season, event_id)
	var awards: Array = []
	for row in receipt.classification:
		var eligible = row.person_id in policy.eligible_people
		awards.append({
			"person_id": row.person_id,
			"team_id": row.team_id,
			"position": int(row.position),
			"eligible": eligible,
			"points": CampaignWeekendPolicy.points_for(policy, int(row.position)) if eligible else 0
		})
	var event = {
		"season_id": receipt.season_id,
		"series_id": season.series_id,
		"round": int(scheduled.round),
		"result_digest": receipt.result_digest,
		"policy_digest": policy.digest,
		"awards": awards
	}
	var candidate_events = data.events.duplicate(true)
	candidate_events[event_id] = event
	var changed = CampaignSeason.apply_event(season, event_id, event, rules, candidate_events)
	if not changed.ok:
		return {"ok": false, "status": "rejected", "error": changed.error, "competition": current.duplicate(true)}
	data.events = candidate_events
	data.seasons[receipt.season_id] = changed.season
	_seal(data)
	error = validate(data)
	return {"ok": error.is_empty(), "status": "applied" if error.is_empty() else "rejected",
		"error": error, "competition": data if error.is_empty() else current.duplicate(true)}

static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign competition exceeds serialized-value limits."
	if not data is Dictionary or data.get("kind") != KIND:
		return "Unsupported campaign competition projection."
	if RaceCheckpoint.integral(data.get("version"), LEGACY_VERSION, LEGACY_VERSION):
		return _validate_legacy(data)
	if not RaceCheckpoint.integral(data.get("version"), VERSION, VERSION) or data.size() != 7 \
			or not CampaignIdentity.valid(data.get("campaign_id")):
		return "Campaign competition version, shape or identity is invalid."
	if not data.get("series") is Dictionary or data.series.size() > MAX_SERIES \
			or not data.get("seasons") is Dictionary or data.seasons.size() > MAX_SEASONS \
			or not data.get("events") is Dictionary or data.events.size() > MAX_EVENTS:
		return "Campaign competition collections are invalid."
	for series_id in data.series:
		if series_id != data.series[series_id].get("series_id"):
			return "Campaign series key disagrees with its identity."
		var rules_error = CampaignSeriesRules.validate(data.series[series_id])
		if not rules_error.is_empty():
			return rules_error
	for event_id in data.events:
		if not CampaignIdentity.valid(event_id):
			return "Campaign competition has an invalid event identity."
		var event = data.events[event_id]
		if not event is Dictionary or not data.seasons.has(event.get("season_id")):
			return "Campaign competition event references an unknown season."
		var season: Dictionary = data.seasons[event.season_id]
		if not data.series.has(season.get("series_id")):
			return "Campaign competition event references an unknown series."
		var event_error = _event_error(event, data.series[season.series_id])
		if not event_error.is_empty():
			return event_error
		if event.series_id != season.series_id:
			return "Campaign competition event disagrees with its season series."
		var calendar = CampaignSeason.calendar_event(season, event_id)
		if calendar.is_empty() or int(calendar.round) != int(event.round):
			return "Campaign competition event disagrees with its calendar round."
	var calendar_ids = {}
	for season_id in data.seasons:
		var season = data.seasons[season_id]
		if season_id != season.get("season_id") or not data.series.has(season.get("series_id")):
			return "Campaign season key or series reference is invalid."
		var season_error = CampaignSeason.validate(season, data.series[season.series_id], data.events)
		if not season_error.is_empty():
			return season_error
		for item in season.calendar:
			if calendar_ids.has(item.campaign_event_id):
				return "Campaign event identities must remain unique across every season."
			calendar_ids[item.campaign_event_id] = season_id
	var content = data.duplicate(true)
	content.erase("digest")
	if not CampaignIdentity.valid_hash(data.get("digest")) or data.digest != RaceStateValue.fingerprint(content):
		return "Campaign competition integrity check failed."
	return ""

static func _event_error(event: Variant, rules: Dictionary) -> String:
	if not event is Dictionary or event.size() != 6:
		return "Campaign competition event has an unsupported shape."
	for key in ["season_id", "series_id"]:
		if not CampaignIdentity.valid(event.get(key)):
			return "Campaign competition event has an invalid " + key + "."
	if not RaceCheckpoint.integral(event.get("round"), 1, CampaignSeriesRules.MAX_EVENTS):
		return "Campaign competition event has an invalid round."
	for key in ["result_digest", "policy_digest"]:
		if not CampaignIdentity.valid_hash(event.get(key)):
			return "Campaign competition event has an invalid source digest."
	if not event.get("awards") is Array or event.awards.size() < 2 \
			or event.awards.size() > CampaignWeekendReceipt.MAX_ENTRANTS:
		return "Campaign competition event has an invalid awards table."
	var people = {}
	for index in range(event.awards.size()):
		var award = event.awards[index]
		if not award is Dictionary or award.size() != 5:
			return "Campaign competition award has an unsupported shape."
		if not CampaignIdentity.valid(award.get("person_id")) or not CampaignIdentity.valid(award.get("team_id")) \
				or people.has(award.person_id):
			return "Campaign competition award has an invalid or repeated identity."
		people[award.person_id] = true
		if not RaceCheckpoint.integral(award.get("position"), index + 1, index + 1) \
				or not award.get("eligible") is bool:
			return "Campaign competition award ordering or eligibility is invalid."
		var expected = 0
		if award.eligible and int(award.position) <= rules.points_by_position.size():
			expected = int(rules.points_by_position[int(award.position) - 1])
		if not RaceCheckpoint.integral(award.get("points"), 0, MAX_POINTS) or int(award.points) != expected:
			return "Campaign competition award points disagree with frozen series rules."
	return ""

static func _season_context(current: Dictionary, season_id: String) -> Dictionary:
	var writable = _writable(current)
	if not writable.ok:
		return writable
	var data: Dictionary = writable.competition
	if not CampaignIdentity.valid(season_id) or not data.seasons.has(season_id):
		return {"ok": false, "error": "Campaign season is unknown."}
	var season: Dictionary = data.seasons[season_id]
	return {"ok": true, "competition": data, "season": season,
		"rules": data.series[season.series_id]}

static func _publish_season(data: Dictionary, season_id: String, changed: Dictionary, original: Dictionary) -> Dictionary:
	if not changed.ok:
		return _reject(changed.error, original)
	data.seasons[season_id] = changed.season
	_seal(data)
	var error = validate(data)
	return _result(error, changed.status, data, original)

static func _writable(current: Dictionary) -> Dictionary:
	var error = validate(current)
	if not error.is_empty():
		return {"ok": false, "error": error}
	if int(current.version) == VERSION:
		return {"ok": true, "competition": current.duplicate(true)}
	if current.events.is_empty() and current.seasons.is_empty():
		return {"ok": true, "competition": empty(current.campaign_id)}
	return {"ok": false, "error": "Legacy sporting history is read-only until an explicit calendar migration is supplied."}

static func _result(error: String, status: String, candidate: Dictionary, original: Dictionary) -> Dictionary:
	return {"ok": error.is_empty(), "status": status if error.is_empty() else "rejected", "error": error,
		"competition": candidate if error.is_empty() else original.duplicate(true)}

static func _reject(message: String, current: Dictionary) -> Dictionary:
	return {"ok": false, "status": "rejected", "error": message, "competition": current.duplicate(true)}

static func _seal(data: Dictionary) -> void:
	data.erase("digest")
	data["digest"] = RaceStateValue.fingerprint(data)

static func _validate_legacy(data: Dictionary) -> String:
	if data.size() != 6 or not CampaignIdentity.valid(data.get("campaign_id")) \
			or not data.get("seasons") is Dictionary or not data.get("events") is Dictionary \
			or data.events.size() > MAX_EVENTS:
		return "Unsupported legacy campaign competition projection."
	for event_id in data.events:
		if not CampaignIdentity.valid(event_id):
			return "Legacy campaign competition has an invalid event identity."
		var event = data.events[event_id]
		if not event is Dictionary or event.size() != 4 or not CampaignIdentity.valid(event.get("season_id")):
			return "Legacy campaign competition event has an unsupported shape."
		for key in ["result_digest", "policy_digest"]:
			if not CampaignIdentity.valid_hash(event.get(key)):
				return "Legacy campaign competition event has an invalid source digest."
		if not event.get("awards") is Array or event.awards.size() < 2 \
				or event.awards.size() > CampaignWeekendReceipt.MAX_ENTRANTS:
			return "Legacy campaign competition event has an invalid awards table."
		var people = {}
		for index in range(event.awards.size()):
			var award = event.awards[index]
			if not award is Dictionary or award.size() != 5:
				return "Legacy campaign competition award has an unsupported shape."
			if not CampaignIdentity.valid(award.get("person_id")) or not CampaignIdentity.valid(award.get("team_id")) \
					or people.has(award.person_id):
				return "Legacy campaign competition award has an invalid or repeated identity."
			people[award.person_id] = true
			if not RaceCheckpoint.integral(award.get("position"), index + 1, index + 1) \
					or not award.get("eligible") is bool:
				return "Legacy campaign competition award ordering or eligibility is invalid."
			if not RaceCheckpoint.integral(award.get("points"), 0, MAX_POINTS) \
					or (not award.eligible and int(award.points) != 0):
				return "Legacy campaign competition award points are invalid."
	var rebuilt = _rebuild_legacy(data.events)
	if RaceStateValue.fingerprint(rebuilt) != RaceStateValue.fingerprint(data.seasons):
		return "Legacy campaign standings disagree with their event awards."
	var content = data.duplicate(true)
	content.erase("digest")
	if not CampaignIdentity.valid_hash(data.get("digest")) or data.digest != RaceStateValue.fingerprint(content):
		return "Legacy campaign competition integrity check failed."
	return ""

static func _rebuild_legacy(events: Dictionary) -> Dictionary:
	var seasons = {}
	var event_ids = events.keys()
	event_ids.sort()
	for event_id in event_ids:
		var event: Dictionary = events[event_id]
		if not seasons.has(event.season_id):
			seasons[event.season_id] = {"drivers": {}, "teams": {}}
		var season: Dictionary = seasons[event.season_id]
		for award in event.awards:
			if not season.drivers.has(award.person_id):
				season.drivers[award.person_id] = {"points": 0, "starts": 0, "wins": 0,
					"best_position": CampaignWeekendReceipt.MAX_ENTRANTS + 1}
			if not season.teams.has(award.team_id):
				season.teams[award.team_id] = {"points": 0, "starts": 0, "wins": 0,
					"best_position": CampaignWeekendReceipt.MAX_ENTRANTS + 1}
			for key in ["drivers", "teams"]:
				var identity = award.person_id if key == "drivers" else award.team_id
				var row: Dictionary = season[key][identity]
				row.points = int(row.points) + int(award.points)
				row.starts = int(row.starts) + 1
				row.wins = int(row.wins) + (1 if int(award.position) == 1 else 0)
				row.best_position = mini(int(row.best_position), int(award.position))
	return seasons
