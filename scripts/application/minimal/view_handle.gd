class_name MinimalRaceHandle
extends RefCounted
## Only input intent, detached observations, and read-only save status reach the UI.
var controls: MinimalRaceControls
var query: MinimalWeekendQuery
var visual_source: RaceVisualPort
var status: RaceSessionStatus


func _init(simulation: RaceSim, runner: RaceSessionRunner) -> void:
	controls = MinimalRaceControls.new()
	controls.configure(simulation)
	query = MinimalWeekendQuery.new(simulation)
	visual_source = RaceVisualSource.new(simulation)
	status = RaceSessionStatus.new(runner)


func selected_driver() -> int:
	return controls.selected_driver()
