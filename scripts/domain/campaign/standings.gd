class_name CampaignStandings
extends RefCounted
## Deterministic driver/team totals and sporting countback rankings from event awards.


static func build(season_id: String, events: Dictionary, rules: Dictionary) -> Dictionary:
	var drivers = {}
	var teams = {}
	var event_ids = events.keys()
	event_ids.sort()
	for event_id in event_ids:
		var event = events[event_id]
		if not event is Dictionary or event.get("season_id") != season_id:
			continue
		for award in event.get("awards", []):
			_accumulate(drivers, award.person_id, award, rules)
			_accumulate(teams, award.team_id, award, rules)
	return {
		"drivers": drivers,
		"teams": teams,
		"rankings":
		{
			"drivers": _rank(drivers, int(rules.countback_depth)),
			"teams": _rank(teams, int(rules.countback_depth))
		}
	}


static func shape_error(data: Dictionary) -> String:
	if (
		not data.get("drivers") is Dictionary
		or not data.get("teams") is Dictionary
		or not data.get("rankings") is Dictionary
		or data.rankings.size() != 2
		or not data.rankings.get("drivers") is Array
		or not data.rankings.get("teams") is Array
	):
		return "Campaign season standings have an unsupported shape."
	return ""


static func projection_error(data: Dictionary, expected: Dictionary) -> String:
	for key in ["drivers", "teams", "rankings"]:
		if RaceStateValue.fingerprint(expected[key]) != RaceStateValue.fingerprint(data[key]):
			return "Campaign season standings disagree with completed event awards."
	return ""


static func _accumulate(
	rows: Dictionary, identity: String, award: Dictionary, rules: Dictionary
) -> void:
	if not rows.has(identity):
		var counts: Array = []
		counts.resize(int(rules.countback_depth))
		counts.fill(0)
		rows[identity] = {
			"points": 0,
			"starts": 0,
			"wins": 0,
			"best_position": CampaignWeekendReceipt.MAX_ENTRANTS + 1,
			"finish_counts": counts
		}
	var row: Dictionary = rows[identity]
	row.points = int(row.points) + int(award.points)
	row.starts = int(row.starts) + 1
	row.wins = int(row.wins) + (1 if int(award.position) == 1 else 0)
	row.best_position = mini(int(row.best_position), int(award.position))
	if int(award.position) <= row.finish_counts.size():
		row.finish_counts[int(award.position) - 1] = (
			int(row.finish_counts[int(award.position) - 1]) + 1
		)


static func _rank(rows: Dictionary, depth: int) -> Array:
	var ordered: Array = []
	for identity in rows.keys():
		var inserted = false
		for index in range(ordered.size()):
			var comparison = _compare(rows[identity], rows[ordered[index]], depth)
			if comparison < 0 or (comparison == 0 and str(identity) < str(ordered[index])):
				ordered.insert(index, identity)
				inserted = true
				break
		if not inserted:
			ordered.append(identity)
	var result: Array = []
	var index = 0
	while index < ordered.size():
		var end = index + 1
		while (
			end < ordered.size() and _compare(rows[ordered[index]], rows[ordered[end]], depth) == 0
		):
			end += 1
		var shared = end - index > 1
		for member in range(index, end):
			var identity = ordered[member]
			result.append(
				{
					"identity": identity,
					"position": index + 1,
					"shared": shared,
					"points": int(rows[identity].points)
				}
			)
		index = end
	return result


static func _compare(left: Dictionary, right: Dictionary, depth: int) -> int:
	if int(left.points) != int(right.points):
		return -1 if int(left.points) > int(right.points) else 1
	for index in range(depth):
		var left_count = int(left.finish_counts[index])
		var right_count = int(right.finish_counts[index])
		if left_count != right_count:
			return -1 if left_count > right_count else 1
	return 0
