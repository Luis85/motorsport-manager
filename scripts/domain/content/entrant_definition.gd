class_name RaceEntrantDefinition
extends RefCounted
## Frozen launch inputs. Runtime positions and condition stay in RaceCar.
var _data: Dictionary = {}

static func create(driver: Dictionary, team: Dictionary, entry: Dictionary,
		player_team: String, box_fraction: float) -> RaceEntrantDefinition:
	var result = RaceEntrantDefinition.new()
	result._data = RaceStateValue.read_only({"driver_id": driver.id, "team_id": team.id,
		"short": driver.short, "name": driver.name, "team": team.name,
		"color": entry.color, "skill": float(driver.skill),
		"consistency": float(driver.consistency), "wet_skill": float(driver.wet_skill),
		"reliability": float(driver.reliability), "number": int(entry.number),
		"player": team.id == player_team, "box_fraction": box_fraction})
	return result

func values() -> Dictionary:
	return _data

var team_id: String:
	get: return str(_data.get("team_id", ""))
var driver_id: String:
	get: return str(_data.get("driver_id", ""))
