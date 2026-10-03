extends RefCounted
## Dependency-free domain contract used by fixed-step services. It contains only
## the state/method shape those services require and does not depend on mechanics
## or on the concrete RaceSim aggregate.
const STEP = 0.05
const ACTIVE = ["practice", "qualifying", "formation", "lights", "race"]

var tuning: RaceTuningDefinition = RaceTuningDefinition.legacy()
var setup_definition: SetupDefinition = SetupDefinition.legacy()
var tyre_rules: RaceTyreRules = RaceTyreRules.legacy()
var track: TrackGeometry
var cars: Array[RaceCar] = []
var phase = "briefing"
var clock = 0.0
var total_time = 0.0
var accumulator = 0.0
var speed = 1
var paused = false
var laps = 12
var qual_closed = false
var water: Array = []
var pit_boxes: Dictionary = {}
var chequered = false
var finish_count = 0
var fastest = 0.0
var stats = {"passes": 0, "incidents": 0, "pits": 0, "blue_flags": 0}
## Dependency-free aggregate state, timing and finite-resource contract.


func post(_kind: String, _text: String) -> void:
	pass


func transition(_next: String) -> void:
	pass


func average(_values: Array) -> float:
	return 0.0


func recommended_compound() -> String:
	return ""


func depart_on_planned_set(_c: RaceCar) -> void:
	pass


func race_crossings(_c: RaceCar, _before: float, _after: float) -> void:
	pass


func queue_pit(_c: RaceCar) -> void:
	pass


func standings(_qualifying: bool = false) -> Array:
	return []


func surface_at(_c: RaceCar) -> Dictionary:
	return {}


func check_tyre_incident(_c: RaceCar) -> void:
	pass


func player_team_label() -> String:
	return "player-team"


func step() -> void:
	pass


static func format_time(value: float) -> String:
	if value <= 0:
		return "—"
	return "%d:%06.3f" % [int(value / 60), fmod(value, 60)]
