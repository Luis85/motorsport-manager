class_name RaceSimPort
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

func post(_kind: String, _text: String) -> void: pass
func transition(_next: String) -> void: pass
func average(_values: Array) -> float: return 0.0
func recommended_compound() -> String: return ""
func depart_on_planned_set(_c: RaceCar) -> void: pass
func race_crossings(_c: RaceCar, _before: float, _after: float) -> void: pass
func queue_pit(_c: RaceCar) -> void: pass
func standings(_qualifying: bool = false) -> Array: return []
func surface_at(_c: RaceCar) -> Dictionary: return {}
func check_tyre_incident(_c: RaceCar) -> void: pass
func player_team_label() -> String: return "player-team"

func step() -> void: pass
func service_random_value() -> float: return 0.0
func begin_service(_c: RaceCar) -> void: pass
func complete_service(_c: RaceCar) -> void: pass
func pit_exit_message(_c: RaceCar) -> String: return ""
func record_stint(_c: RaceCar) -> void: pass
func update_surface() -> void: pass
func update_flags() -> void: pass
func engineer(_c: RaceCar) -> void: pass
func leave_garage(_c: RaceCar) -> void: pass
func update_pit(_c: RaceCar, _old: Array = []) -> void: pass
func move_car(_c: RaceCar, _old: Array) -> void: pass
func neutral(_c: RaceCar) -> bool: return false
func neutral_speed_limit(_c: RaceCar, _sample: Dictionary) -> float: return 0.0
func update_yield(_c: RaceCar, _old: Array) -> float: return 0.0
func traffic_instruction(_c: RaceCar, _old: Array, _nearest: int, _gap: float,
		desired: float, lane: float, _sample: Dictionary, _local: Dictionary) -> Dictionary:
	return {"desired": desired, "lane": lane, "attempt": false, "block_pass": false}
func constrain_progress(_c: RaceCar, next: float, _old: Array, _nearest: int) -> float: return next
func plan_pit_gate(_c: RaceCar) -> void: pass
func wear_car(_c: RaceCar, _distance: float, _cell: int,
		_effects: Dictionary = {}, _local: Dictionary = {}) -> void: pass
func qualifying_crossings(_c: RaceCar, _before: float, _after: float) -> void: pass
func record_track_pass(_c: RaceCar, _other: RaceCar) -> void: pass
func incident(_c: RaceCar) -> void: pass
func is_run_session() -> bool: return false
func pit_status(_c: RaceCar) -> String: return ""
func retire(_c: RaceCar, _reason: String) -> void: pass

static func format_time(value: float) -> String:
	if value <= 0: return "—"
	return "%d:%06.3f" % [int(value / 60), fmod(value, 60)]
