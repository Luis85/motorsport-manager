class_name EntrantDefinition
extends RefCounted
## One frozen event entry. Live fuel, wear, timing and ownership remain RaceCar state.
var _driver: Dictionary
var _team: Dictionary
var _entry: Dictionary
var _player: bool
var _pit_fraction: float
var driver_id: String:
	get: return _driver.id
var team_id: String:
	get: return _team.id
var player: bool:
	get: return _player
var pit_fraction: float:
	get: return _pit_fraction

func _init(driver: Dictionary, team: Dictionary, entry: Dictionary,
		owned: bool, pit: float) -> void:
	_driver = RaceStateValue.read_only(driver)
	_team = RaceStateValue.read_only(team)
	_entry = RaceStateValue.read_only(entry)
	_player = owned
	_pit_fraction = pit

func legacy_row() -> Array:
	## Internal constructor adapter only. External authoring uses named fields.
	return [_driver.short, _driver.name, _team.name, _entry.color if not _entry.color.is_empty() else _team.color,
		_driver.skill, _driver.consistency, _driver.wet_skill, _driver.reliability, _entry.number]
