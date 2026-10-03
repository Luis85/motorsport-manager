class_name RaceViewSession
extends RefCounted
## Application-owned lifetime binding. Widgets receive view, never this binding.
var runner: RaceSessionRunner
var view: RaceViewHandle


func _init(simulation: RaceSim) -> void:
	runner = RaceSessionRunner.new(simulation)
	view = RaceViewHandle.new(simulation, runner)
