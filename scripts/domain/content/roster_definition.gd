class_name RaceRosterDefinition
extends RefCounted
## Validated closure of one entry list and its teams/drivers, independent of disk.
## Entry order is authoritative. Dictionary order and display names never confer authority.
var _snapshot: Dictionary = {}
var _entrants: Array[RaceEntrantDefinition] = []
var count: int:
	get: return _entrants.size()
var id: String:
	get: return str(_snapshot.get("roster", {}).get("id", ""))

static func resolve(roster: Dictionary, records: Dictionary) -> Dictionary:
	var errors = ContentValidation.check(roster, ContentSchema.definition("roster"))
	if not errors.is_empty(): return {"ok": false, "diagnostics": errors}
	var drivers: Dictionary = {}
	var teams: Dictionary = {}
	for index in range(roster.entries.size()):
		var entry = roster.entries[index]
		for field in ["driver_id", "team_id"]:
			var expected = "driver" if field == "driver_id" else "team"
			var record: Dictionary = records.get(entry[field], {})
			if record.get("kind") != expected:
				errors.append(ContentValidation.diagnostic("CONTENT_REFERENCE_MISSING",
					"/entries/%d/%s" % [index, field], "Unknown " + expected + ": " + entry[field]))
			elif field == "driver_id": drivers[entry[field]] = record
			else: teams[entry[field]] = record
	if not errors.is_empty(): return {"ok": false, "diagnostics": errors}
	var snapshot = {"kind": "motorsport-manager-roster-snapshot", "version": 1,
		"roster": roster, "drivers": drivers.values(), "teams": teams.values()}
	errors = snapshot_errors(snapshot)
	return {"ok": errors.is_empty(), "diagnostics": errors, "snapshot": snapshot}

static func snapshot_errors(snapshot: Variant) -> Array:
	var errors = ContentValidation.check(snapshot, ContentSchema.roster_snapshot())
	if not errors.is_empty(): return errors
	var roster: Dictionary = snapshot.roster
	var drivers: Dictionary = {}
	var teams: Dictionary = {}
	for row in snapshot.drivers:
		if drivers.has(row.id): return _error("Duplicate driver definition.", "/drivers")
		drivers[row.id] = row
	for row in snapshot.teams:
		if teams.has(row.id): return _error("Duplicate team definition.", "/teams")
		teams[row.id] = row
	var seen: Dictionary = {}
	var numbers: Dictionary = {}
	var used_teams: Dictionary = {}
	var players = 0
	var team_counts: Dictionary = {}
	for entry in roster.entries:
		if not drivers.has(entry.driver_id) or not teams.has(entry.team_id):
			return _error("Roster references a missing driver or team.", "/roster/entries")
		if seen.has(entry.driver_id) or numbers.has(int(entry.number)):
			return _error("A driver and racing number may appear only once.", "/roster/entries")
		seen[entry.driver_id] = true
		numbers[int(entry.number)] = true
		used_teams[entry.team_id] = true
		team_counts[entry.team_id] = team_counts.get(entry.team_id, 0) + 1
		if team_counts[entry.team_id] > 2: return _error("The supported team forecast requires at most two entries per team.", "/roster/entries")
		if entry.team_id == roster.player_team_id: players += 1
	if players != 2: return _error("The current pitwall requires exactly two player-team entries.", "/roster/player_team_id")
	if seen.size() != drivers.size() or used_teams.size() != teams.size():
		return _error("Frozen roster must contain exactly its referenced definitions.", "")
	var boxes: Dictionary = {}
	var positions: Array = []
	for box in roster.pit_boxes:
		if not used_teams.has(box.team_id) or boxes.has(box.team_id) or box.fraction in positions:
			return _error("Each entered team needs one distinct pit-box position.", "/roster/pit_boxes")
		boxes[box.team_id] = true
		positions.append(box.fraction)
	if boxes.size() != used_teams.size(): return _error("Missing team pit box.", "/roster/pit_boxes")
	return []

static func _error(message: String, field: String) -> Array:
	return [ContentValidation.diagnostic("CONTENT_ROSTER", field, message)]

static func from_snapshot(snapshot: Variant) -> RaceRosterDefinition:
	if not snapshot_errors(snapshot).is_empty(): return null
	var result = RaceRosterDefinition.new()
	result._snapshot = RaceStateValue.read_only(snapshot)
	var drivers: Dictionary = {}
	var teams: Dictionary = {}
	var boxes: Dictionary = {}
	for row in snapshot.drivers: drivers[row.id] = row
	for row in snapshot.teams: teams[row.id] = row
	for box in snapshot.roster.pit_boxes: boxes[box.team_id] = float(box.fraction)
	for entry in snapshot.roster.entries:
		result._entrants.append(RaceEntrantDefinition.create(drivers[entry.driver_id],
			teams[entry.team_id], entry, snapshot.roster.player_team_id, boxes[entry.team_id]))
	return result

func entrant(index: int) -> RaceEntrantDefinition:
	return _entrants[index] if index >= 0 and index < count else null

func to_snapshot() -> Dictionary:
	return _snapshot.duplicate(true)

func player_ids() -> Array:
	var result: Array = []
	for index in range(count):
		if _entrants[index].values().player: result.append(index)
	return result

func track_errors(track: TrackGeometry) -> Array[String]:
	var errors: Array[String] = []
	if int(track.document.grid.get("count", 12)) < count:
		errors.append("The authored grid has fewer places than this roster. Increase its grid count in the track editor.")
	if (count - 1) * track.grid_spacing > track.length * 0.4:
		errors.append("The selected roster is too large for this circuit's grid spacing.")
	var positions: Array = []
	for box in _snapshot.roster.pit_boxes: positions.append(float(box.fraction) * track.pit_length)
	positions.sort()
	for index in range(1, positions.size()):
		if positions[index] - positions[index - 1] < 8.0:
			errors.append("Team pit boxes need at least eight metres between service positions.")
			break
	return errors

func pit_markers() -> Array:
	var result: Array = []
	for box in _snapshot.roster.pit_boxes:
		result.append({"fraction": float(box.fraction), "player": box.team_id == _snapshot.roster.player_team_id})
	return result
