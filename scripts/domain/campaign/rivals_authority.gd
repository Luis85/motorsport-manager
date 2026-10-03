class_name CampaignRivalsAuthority
extends RefCounted
## Rival rosters must be accepted season entries and rival reviews cannot come from the future.


static func validate(rivals: Dictionary, competition: Dictionary, current_slot: int) -> String:
	var error = CampaignRivals.validate(rivals)
	if not error.is_empty():
		return error
	error = CampaignCompetition.validate(competition)
	if not error.is_empty():
		return error
	if not RaceCheckpoint.integral(current_slot, 0, CampaignClock.MAX_ELAPSED_SLOTS):
		return "Campaign rival authority has invalid time."
	for team in rivals.teams.values():
		if int(team.created_slot) > current_slot or int(team.last_review_slot) > current_slot:
			return "Campaign rival history is dated after authoritative campaign time."
		var found = false
		for season in competition.seasons.values():
			for entry in season.entries.values():
				if (
					entry.status == "accepted"
					and entry.entrant_id == team.entrant_id
					and entry.team_id == team.team_id
					and entry.person_ids == team.person_ids
					and entry.car_ids == team.car_ids
				):
					found = true
					break
			if found:
				break
		if not found:
			return "Campaign rival roster is not backed by an accepted season entry."
	for cycle in rivals.decision_cycles:
		if int(cycle.slot) > current_slot:
			return "Campaign rival decision is dated after authoritative campaign time."
	return ""
