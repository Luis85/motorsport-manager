class_name RaceViewSession
extends RefCounted
## Construction boundary: the same model supplies independent commands/readers/runner.
var query: RaceViewQuery
var commands: RaceCommands
var runner: RaceSessionRunner
var director: RaceMomentControl

func _init(simulation: RaceSim) -> void:
	query = RaceViewQuery.new(simulation)
	commands = RaceCommands.new(simulation)
	runner = RaceSessionRunner.new(simulation)
	director = RaceMomentControl.new(simulation)

func _notification(what: int) -> void:
	if what == NOTIFICATION_PREDELETE and director != null:
		director.detach()
