class_name RosterDefinition
extends RefCounted
## Closed, validated event roster. Neither catalogs nor source files are consulted at restore.
const MAX_ENTRANTS = 24
var _snapshot: Dictionary
var _entries: Array[EntrantDefinition] = []
var _player_ids: Array = []
var size: int:
	get: return _entries.size()
var id: String:
	get: return _snapshot.roster.id

func entry(index: int) -> EntrantDefinition:
	return _entries[index] if index >= 0 and index < size else null

func players() -> Array:
	return _player_ids.duplicate()

func to_record() -> Dictionary:
	return _snapshot.duplicate(true)

static func compile(roster: Dictionary, records: Dictionary) -> Dictionary:
	var errors = ContentValidation.check(roster, ContentSchema.definition("roster"))
	if not errors.is_empty(): return {"ok": false, "diagnostics": errors}
	var teams: Dictionary = {}
	var drivers: Dictionary = {}
	for index in range(roster.entries.size()):
		var item = roster.entries[index]
		for pair in [["team", item.team_id, teams], ["driver", item.driver_id, drivers]]:
			var definition = records.get(pair[1], {})
			if definition.get("kind") != pair[0]:
				return failure("CONTENT_REFERENCE_MISSING", "/entries/" + str(index) + "/" + pair[0] + "_id",
					"Unknown " + pair[0] + " definition: " + pair[1])
			pair[2][pair[1]] = definition
	return from_snapshot({"kind": "motorsport-manager-roster", "version": 1, "roster": roster,
		"teams": teams.values(), "drivers": drivers.values()})

static func from_snapshot(snapshot: Variant) -> Dictionary:
	var errors = ContentValidation.check(snapshot, ContentSchema.roster_snapshot())
	if not errors.is_empty(): return {"ok": false, "diagnostics": errors}
	var teams: Dictionary = {}
	var drivers: Dictionary = {}
	for pair in [["teams", teams], ["drivers", drivers]]:
		for definition in snapshot[pair[0]]:
			if pair[1].has(definition.id):
				return failure("CONTENT_DUPLICATE_ID", "/" + pair[0], "Duplicate snapshot definition ID.")
			pair[1][definition.id] = definition
	var roster: Dictionary = snapshot.roster
	var pits: Dictionary = {}
	var fractions: Array = []
	for assignment in roster.pit_assignments:
		if not teams.has(assignment.team_id) or pits.has(assignment.team_id):
			return failure("CONTENT_PIT_ASSIGNMENT", "/roster/pit_assignments", "Every participating team needs one unique pit assignment.")
		if assignment.fraction in fractions:
			return failure("CONTENT_PIT_ASSIGNMENT", "/roster/pit_assignments", "Different teams cannot share a pit position.")
		pits[assignment.team_id] = assignment.fraction
		fractions.append(assignment.fraction)
	if pits.size() != teams.size() or not teams.has(roster.player_team_id):
		return failure("CONTENT_ROSTER", "/roster", "A participating player team and complete pit assignments are required.")
	var result = RosterDefinition.new()
	var used: Dictionary = {}
	var counts: Dictionary = {}
	var numbers: Array = []
	for index in range(roster.entries.size()):
		var item = roster.entries[index]
		if not teams.has(item.team_id) or not drivers.has(item.driver_id):
			return failure("CONTENT_REFERENCE_MISSING", "/roster/entries/" + str(index), "The frozen roster is missing a referenced definition.")
		if used.has(item.driver_id) or item.number in numbers:
			return failure("CONTENT_ROSTER", "/roster/entries/" + str(index), "Drivers and racing numbers must be unique within an event.")
		used[item.driver_id] = true
		numbers.append(item.number)
		counts[item.team_id] = int(counts.get(item.team_id, 0)) + 1
		var owned = item.team_id == roster.player_team_id
		result._entries.append(EntrantDefinition.new(drivers[item.driver_id], teams[item.team_id], item, owned, pits[item.team_id]))
		if owned: result._player_ids.append(index)
	if used.size() != drivers.size() or counts.size() != teams.size():
		return failure("CONTENT_ROSTER", "/roster", "A frozen roster must contain exactly its referenced drivers and teams.")
	if not counts.values().all(func(count): return count == 2):
		return failure("CONTENT_ROSTER", "/roster/entries", "This rule family supports two cars per team, including the player team.")
	result._snapshot = RaceStateValue.read_only(snapshot)
	return {"ok": true, "definition": result, "diagnostics": []}

static func failure(code: String, path: String, message: String) -> Dictionary:
	return {"ok": false, "diagnostics": [ContentValidation.diagnostic(code, path, message)]}

func geometry_error(track: TrackGeometry) -> String:
	if int(track.document.grid.get("count", 12)) < size:
		return "This circuit's authored grid is too small for the selected field."
	var positions = _snapshot.roster.pit_assignments.map(func(p): return float(p.fraction) * track.pit_length)
	positions.sort()
	for index in range(1, positions.size()):
		if positions[index] - positions[index - 1] < 6.0:
			return "Pit assignments need at least six metres of separation on this circuit."
	return ""
