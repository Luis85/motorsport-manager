class_name StandaloneSmokeFiles
extends Storage.FileOperations
## Injected replacement interruptions for the explicit packaged smoke journey.
var boundary: String


func pause_process() -> void:
	# The external launcher kills this process only after a real flushed stage.
	var file = FileAccess.open("user://replacement-paused", FileAccess.WRITE)
	file.store_string(boundary)
	file.flush()
	file.close()
	while true:
		OS.delay_msec(50)


func write_text(path: String, text: String) -> String:
	var error = super.write_text(path, text)
	if error.is_empty() and boundary == "temp" and path.ends_with("atomic.json.tmp"):
		pause_process()
	return error


func rename(source: String, destination: String) -> Error:
	var error = super.rename(source, destination)
	if error == OK and boundary == "backup" and destination.ends_with("atomic.json.bak"):
		pause_process()
	return error
