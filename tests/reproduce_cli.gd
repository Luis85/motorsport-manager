extends SceneTree


## Developer entrypoint, excluded from ordinary export presets.
func _initialize() -> void:
	call_deferred("run")


func run() -> void:
	var args = OS.get_cmdline_user_args()
	if args.size() != 2:
		printerr("Expected absolute bundle and result paths after --")
		quit(2)
		return
	var read = Storage.read_json(args[0])
	if not read.ok or not read.data is Dictionary:
		printerr(read.get("error", "Expected a reproduction object."))
		quit(2)
		return
	var result = RaceReproduction.diagnose(read.data)
	var error = Storage.write_json(args[1], result)
	if not error.is_empty():
		printerr(error)
		quit(2)
		return
	print("REPRODUCTION_RESULT ", JSON.stringify(result))
	quit(0 if result.get("ok", false) and result.get("matched", false) else 1)
