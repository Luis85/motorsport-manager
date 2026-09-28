class_name RaceViewHandle
extends RefCounted
## UI capabilities deliberately omit the live scheduler and mutable aggregate.
var query: RaceViewQuery
var commands: RaceCommands
var director: RaceMomentControl
var status: RaceSessionStatus
func _init(simulation: RaceSim, runner: RaceSessionRunner) -> void:
	query = RaceViewQuery.new(simulation)
	commands = RaceCommands.new(simulation)
	director = RaceMomentControl.new(simulation)
	status = RaceSessionStatus.new(runner)
func _notification(what: int) -> void:
	if what == NOTIFICATION_PREDELETE and director != null:
		director.detach()
