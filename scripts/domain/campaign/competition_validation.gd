class_name CampaignCompetitionValidation
extends RefCounted
## Pure validation of detached campaign records.
const KIND = CampaignCompetition.KIND
const VERSION = CampaignCompetition.VERSION
const LEGACY_VERSION = CampaignCompetition.LEGACY_VERSION
const MAX_EVENTS = CampaignCompetition.MAX_EVENTS
const MAX_SERIES = CampaignCompetition.MAX_SERIES
const MAX_SEASONS = CampaignCompetition.MAX_SEASONS
const MAX_POINTS = CampaignCompetition.MAX_POINTS


static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign competition exceeds serialized-value limits."
	if not data is Dictionary or data.get("kind") != KIND:
		return "Unsupported campaign competition projection."
	if RaceCheckpoint.integral(data.get("version"), LEGACY_VERSION, LEGACY_VERSION):
		return _validate_legacy(data)
	if (
		not RaceCheckpoint.integral(data.get("version"), VERSION, VERSION)
		or data.size() != 7
		or not CampaignIdentity.valid(data.get("campaign_id"))
	):
		return "Campaign competition version, shape or identity is invalid."
	if (
		not data.get("series") is Dictionary
		or data.series.size() > MAX_SERIES
		or not data.get("seasons") is Dictionary
		or data.seasons.size() > MAX_SEASONS
		or not data.get("events") is Dictionary
		or data.events.size() > MAX_EVENTS
	):
		return "Campaign competition collections are invalid."
	var series_error = _series_error(data)
	if not series_error.is_empty():
		return series_error
	var events_error = _events_error(data)
	if not events_error.is_empty():
		return events_error
	var calendar_ids = {}
	for season_id in data.seasons:
		var season = data.seasons[season_id]
		if (
			not season is Dictionary
			or season_id != season.get("season_id")
			or not data.series.has(season.get("series_id"))
		):
			return "Campaign season key or series reference is invalid."
		var season_error = CampaignSeason.validate(
			season, data.series[season.series_id], data.events
		)
		if not season_error.is_empty():
			return season_error
		for item in season.calendar:
			if calendar_ids.has(item.campaign_event_id):
				return "Campaign event identities must remain unique across every season."
			calendar_ids[item.campaign_event_id] = season_id
	var content = data.duplicate(true)
	content.erase("digest")
	if (
		not CampaignIdentity.valid_hash(data.get("digest"))
		or data.digest != RaceStateValue.fingerprint(content)
	):
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
	if (
		not event.get("awards") is Array
		or event.awards.size() < 2
		or event.awards.size() > CampaignWeekendReceipt.MAX_ENTRANTS
	):
		return "Campaign competition event has an invalid awards table."
	var people = {}
	for index in range(event.awards.size()):
		var award = event.awards[index]
		if not award is Dictionary or award.size() != 5:
			return "Campaign competition award has an unsupported shape."
		if (
			not CampaignIdentity.valid(award.get("person_id"))
			or not CampaignIdentity.valid(award.get("team_id"))
			or people.has(award.person_id)
		):
			return "Campaign competition award has an invalid or repeated identity."
		people[award.person_id] = true
		if (
			not RaceCheckpoint.integral(award.get("position"), index + 1, index + 1)
			or not award.get("eligible") is bool
		):
			return "Campaign competition award ordering or eligibility is invalid."
		var expected = 0
		if award.eligible and int(award.position) <= rules.points_by_position.size():
			expected = int(rules.points_by_position[int(award.position) - 1])
		if (
			not RaceCheckpoint.integral(award.get("points"), 0, MAX_POINTS)
			or int(award.points) != expected
		):
			return "Campaign competition award points disagree with frozen series rules."
	return ""


static func _validate_legacy(data: Dictionary) -> String:
	if (
		data.size() != 6
		or not CampaignIdentity.valid(data.get("campaign_id"))
		or not data.get("seasons") is Dictionary
		or not data.get("events") is Dictionary
		or data.events.size() > MAX_EVENTS
	):
		return "Unsupported legacy campaign competition projection."
	for event_id in data.events:
		if not CampaignIdentity.valid(event_id):
			return "Legacy campaign competition has an invalid event identity."
		var event = data.events[event_id]
		if (
			not event is Dictionary
			or event.size() != 4
			or not CampaignIdentity.valid(event.get("season_id"))
		):
			return "Legacy campaign competition event has an unsupported shape."
		for key in ["result_digest", "policy_digest"]:
			if not CampaignIdentity.valid_hash(event.get(key)):
				return "Legacy campaign competition event has an invalid source digest."
		if (
			not event.get("awards") is Array
			or event.awards.size() < 2
			or event.awards.size() > CampaignWeekendReceipt.MAX_ENTRANTS
		):
			return "Legacy campaign competition event has an invalid awards table."
		var people = {}
		for index in range(event.awards.size()):
			var award = event.awards[index]
			if not award is Dictionary or award.size() != 5:
				return "Legacy campaign competition award has an unsupported shape."
			if (
				not CampaignIdentity.valid(award.get("person_id"))
				or not CampaignIdentity.valid(award.get("team_id"))
				or people.has(award.person_id)
			):
				return "Legacy campaign competition award has an invalid or repeated identity."
			people[award.person_id] = true
			if (
				not RaceCheckpoint.integral(award.get("position"), index + 1, index + 1)
				or not award.get("eligible") is bool
			):
				return "Legacy campaign competition award ordering or eligibility is invalid."
			if (
				not RaceCheckpoint.integral(award.get("points"), 0, MAX_POINTS)
				or (not award.eligible and int(award.points) != 0)
			):
				return "Legacy campaign competition award points are invalid."
	var rebuilt = CampaignCompetition._rebuild_legacy(data.events)
	if RaceStateValue.fingerprint(rebuilt) != RaceStateValue.fingerprint(data.seasons):
		return "Legacy campaign standings disagree with their event awards."
	var content = data.duplicate(true)
	content.erase("digest")
	if (
		not CampaignIdentity.valid_hash(data.get("digest"))
		or data.digest != RaceStateValue.fingerprint(content)
	):
		return "Legacy campaign competition integrity check failed."
	return ""


static func _series_error(data: Dictionary) -> String:
	for series_id in data.series:
		if (
			not data.series[series_id] is Dictionary
			or series_id != data.series[series_id].get("series_id")
		):
			return "Campaign series key disagrees with its identity."
		var rules_error = CampaignSeriesRules.validate(data.series[series_id])
		if not rules_error.is_empty():
			return rules_error
	return ""


static func _events_error(data: Dictionary) -> String:
	for event_id in data.events:
		if not CampaignIdentity.valid(event_id):
			return "Campaign competition has an invalid event identity."
		var event = data.events[event_id]
		if not event is Dictionary or not data.seasons.has(event.get("season_id")):
			return "Campaign competition event references an unknown season."
		var season = data.seasons[event.season_id]
		if not season is Dictionary or not data.series.has(season.get("series_id")):
			return "Campaign competition event references an unknown series."
		var event_error = _event_error(event, data.series[season.series_id])
		if not event_error.is_empty():
			return event_error
		if event.series_id != season.series_id:
			return "Campaign competition event disagrees with its season series."
		var calendar_error = CampaignSeasonCalendar.validate(
			season.get("calendar"), data.series[season.series_id], str(season.get("status", ""))
		)
		if not calendar_error.is_empty():
			return calendar_error
		var calendar = CampaignSeason.calendar_event(season, event_id)
		if calendar.is_empty() or int(calendar.round) != int(event.round):
			return "Campaign competition event disagrees with its calendar round."
	return ""
