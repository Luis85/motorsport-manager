extends SceneTree
## Load every production script after autoload setup, so dependency-root errors
## are named instead of reporting only the cascade from main.gd.
var paths: Array[String] = []
var errors: Array[String] = []

func _initialize() -> void: call_deferred("run")

func collect(path: String) -> void:
	var directory = DirAccess.open(path)
	if directory == null: errors.append("Cannot read " + path); return
	for name in directory.get_files():
		if name.ends_with(".gd"): paths.append(path.path_join(name))
	for name in directory.get_directories():
		if not name.begins_with("."): collect(path.path_join(name))

func run() -> void:
	collect("res://scripts"); paths.sort()
	for path in paths:
		print("SCRIPT_LOAD ", path)
		var script = load(path)
		if script == null or not script is Script or not script.can_instantiate(): errors.append(path)
	var report = {"passed": errors.is_empty(), "checks": paths.size(), "errors": errors, "engine": Engine.get_version_info().string}
	DirAccess.make_dir_recursive_absolute("res://reports")
	var file = FileAccess.open("res://reports/script-load.json", FileAccess.WRITE)
	if file: file.store_string(JSON.stringify(report, "\t")); file.close()
	else: push_error("Could not write script-load report"); quit(1); return
	print("SCRIPT_LOAD_RESULT ", JSON.stringify(report)); quit(0 if errors.is_empty() else 1)
