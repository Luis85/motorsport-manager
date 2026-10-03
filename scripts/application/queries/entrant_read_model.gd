class_name EntrantReadModel
extends RefCounted


## Presentation projects a display name alongside stable identity; live car records stay strict.
static func record(car: RaceCar, roster: RosterDefinition = null) -> Dictionary:
	var result = car.to_record()
	if roster != null:
		var entry = roster.entry(car.id)
		result.team_key = car.team
		result.team = entry.legacy_row()[2]
	return result


static func records(cars: Array[RaceCar], roster: RosterDefinition = null) -> Array:
	var result: Array = []
	for car in cars:
		result.append(record(car, roster))
	return result


static func decode(value: Dictionary, roster: RosterDefinition = null) -> RaceCar:
	if not RaceStateValue.serializable(value):
		return null
	var fields = value.duplicate(true)
	if roster != null:
		if not RaceCheckpoint.integral(fields.get("id"), 0, roster.size - 1):
			return null
		var entry = roster.entry(int(fields.id))
		if fields.get("team_key") != entry.team_id or fields.get("team") != entry.legacy_row()[2]:
			return null
		fields.team = entry.team_id
	fields.erase("team_key")
	return RaceCar.from_record(fields)


static func team_name(car: RaceCar, roster: RosterDefinition = null) -> String:
	return str(roster.entry(car.id).legacy_row()[2]) if roster != null else car.team
