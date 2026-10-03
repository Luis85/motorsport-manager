class_name MinimalRaceSession
extends RefCounted
## Application composition binding. Only view is supplied to presentation.
var runner: RaceSessionRunner
var view: MinimalRaceHandle


func _init(simulation: RaceSim) -> void:
	runner = RaceSessionRunner.new(simulation)
	view = MinimalRaceHandle.new(simulation, runner)
