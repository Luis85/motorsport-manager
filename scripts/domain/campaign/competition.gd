class_name CampaignCompetition
extends RefCounted
## Replay-checkable sporting standings derived only from explicit weekend policies.
const KIND = "motorsport-manager-campaign-competition"
const VERSION = 1
const MAX_EVENTS = 1024
const MAX_POINTS = 1000000000

static func empty(campaign_id: String) -> Dictionary:
	if not CampaignIdentity.valid(campaign_id):
		return {}
	var data = {
		"kind": KIND,
		"version": VERSION,
		"campaign_id": campaign_id,
		"seasons": {},
		"events": {}
	}
	data["digest"] = RaceStateValue.fingerprint(data)
	return data

static func stage(current: Dictionary, receipt: Dictionary, policy: Dictionary) -> Dictionary:
	var data = empty(receipt.get("campaign_id", "")) if current.is_empty() else current.duplicate(true)
	var error = validate(data)
	if not error.is_empty():
		return {"ok": false, "status": "rejected", "error": error}
	error = CampaignWeekendPolicy.receipt_error(policy, receipt)
	if not error.is_empty():
		return {"ok": false, "status": "rejected", "error": error}
	if data.campaign_id != receipt.campaign_id:
		return {"ok": false, "status": "rejected", "error": "Competition projection belongs to another campaign."}
	var event_id: String = receipt.campaign_event_id
	if data.events.has(event_id):
		var previous: Dictionary = data.events[event_id]
		if previous.result_digest == receipt.result_digest and previous.policy_digest == policy.digest:
			return {"ok": true, "status": "already_applied", "competition": data}
		return {"ok": false, "status": "conflict", "error": "Competition consequences already exist for this event under different evidence or rules."}
	if data.events.size() >= MAX_EVENTS:
		return {"ok": false, "status": "rejected", "error": "Competition event history is full."}
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
	data.events[event_id] = {
		"season_id": receipt.season_id,
		"result_digest": receipt.result_digest,
		"policy_digest": policy.digest,
		"awards": awards
	}
	data.seasons = _rebuild(data.events)
	data.erase("digest")
	data["digest"] = RaceStateValue.fingerprint(data)
	error = validate(data)
	return {"ok": error.is_empty(), "status": "applied" if error.is_empty() else "rejected",
		"error": error, "competition": data if error.is_empty() else current.duplicate(true)}

static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign competition exceeds serialized-value limits."
	if not data is Dictionary or data.size() != 6 or data.get("kind") != KIND:
		return "Unsupported campaign competition projection."
	if not RaceCheckpoint.integral(data.get("version"), VERSION, VERSION) or not CampaignIdentity.valid(data.get("campaign_id")):
		return "Campaign competition version or identity is invalid."
	if not data.get("seasons") is Dictionary or not data.get("events") is Dictionary or data.events.size() > MAX_EVENTS:
		return "Campaign competition collections are invalid."
	for event_id in data.events:
		if not CampaignIdentity.valid(event_id):
			return "Campaign competition has an invalid event identity."
		var event = data.events[event_id]
		if not event is Dictionary or event.size() != 4 or not CampaignIdentity.valid(event.get("season_id")):
			return "Campaign competition event has an unsupported shape."
		for key in ["result_digest", "policy_digest"]:
			if not CampaignIdentity.valid_hash(event.get(key)):
				return "Campaign competition event has an invalid source digest."
		if not event.get("awards") is Array or event.awards.size() < 2 or event.awards.size() > CampaignWeekendManifest.MAX_ENTRANTS:
			return "Campaign competition event has an invalid awards table."
		var people = {}
		for index in range(event.awards.size()):
			var award = event.awards[index]
			if not award is Dictionary or award.size() != 5:
				return "Campaign competition award has an unsupported shape."
			if not CampaignIdentity.valid(award.get("person_id")) or not CampaignIdentity.valid(award.get("team_id")) or people.has(award.person_id):
				return "Campaign competition award has an invalid or repeated identity."
			people[award.person_id] = true
			if not RaceCheckpoint.integral(award.get("position"), index + 1, index + 1) or not (award.get("eligible") is bool):
				return "Campaign competition award ordering or eligibility is invalid."
			if not RaceCheckpoint.integral(award.get("points"), 0, MAX_POINTS) or (not award.eligible and int(award.points) != 0):
				return "Campaign competition award points are invalid."
	var rebuilt = _rebuild(data.events)
	if RaceStateValue.fingerprint(rebuilt) != RaceStateValue.fingerprint(data.seasons):
		return "Campaign standings disagree with their event awards."
	var content = data.duplicate(true)
	content.erase("digest")
	if not CampaignIdentity.valid_hash(data.get("digest")) or data.digest != RaceStateValue.fingerprint(content):
		return "Campaign competition integrity check failed."
	return ""

static func _rebuild(events: Dictionary) -> Dictionary:
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
				season.drivers[award.person_id] = {"points": 0, "starts": 0, "wins": 0, "best_position": CampaignWeekendManifest.MAX_ENTRANTS + 1}
			if not season.teams.has(award.team_id):
				season.teams[award.team_id] = {"points": 0, "starts": 0, "wins": 0, "best_position": CampaignWeekendManifest.MAX_ENTRANTS + 1}
			for key in ["drivers", "teams"]:
				var identity = award.person_id if key == "drivers" else award.team_id
				var row: Dictionary = season[key][identity]
				row.points = int(row.points) + int(award.points)
				row.starts = int(row.starts) + 1
				row.wins = int(row.wins) + (1 if int(award.position) == 1 else 0)
				row.best_position = mini(int(row.best_position), int(award.position))
	return seasons
