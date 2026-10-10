extends Node
## Blocking subprocess IO lives on a worker; the scene tree only queues intent.
signal response(method: String, result: Variant)
signal rejected(message: String)
signal response_with_id(request_id: int, method: String, result: Variant)
signal rejected_with_id(request_id: int, message: String)
var process: Dictionary = {}
var pipe: FileAccess
var thread := Thread.new()
var mutex := Mutex.new()
var wake := Semaphore.new()
var requests: Array[Dictionary] = []
var replies: Array[Dictionary] = []
var sequence := 0
var stopping := false
var outstanding := 0
var last_response_id := -1


func launch() -> bool:
	var executable := OS.get_environment("WILDLANDS_NODE")
	if executable.is_empty():
		executable = "node"
	var args := PackedStringArray(
		[
			ProjectSettings.globalize_path("res://runtime/tools/wildlands-runtime.cjs"),
			"--project",
			ProjectSettings.globalize_path("res://wildlands.project.json"),
			"--stdio"
		]
	)
	process = OS.execute_with_pipe(executable, args, true)
	if process.is_empty():
		rejected.emit(
			"Node.js 22+ is required. Install Node or set WILDLANDS_NODE to its executable."
		)
		return false
	pipe = process.get("stdio")
	thread.start(_worker)
	return true


func request(method: String, params: Dictionary = {}) -> int:
	if pipe == null or stopping:
		rejected.emit("The gameplay runtime is unavailable.")
		return -1
	if outstanding >= 32:
		rejected.emit("The gameplay request queue is full. Wait for the current operation.")
		return -1
	sequence += 1
	# Avoid further rounding of command numbers. Persisted stories travel as opaque text.
	var message := JSON.stringify(
		{"id": sequence, "method": method, "params": params}, "", true, true
	)
	if message.to_utf8_buffer().size() > 64 * 1024 * 1024:
		rejected.emit("Gameplay request exceeds 64 MiB.")
		return -1
	mutex.lock()
	requests.append({"id": sequence, "method": method, "text": message})
	mutex.unlock()
	outstanding += 1
	wake.post()
	return sequence


func _worker() -> void:
	while true:
		wake.wait()
		mutex.lock()
		var exit_requested := stopping
		var request_data: Dictionary = requests.pop_front() if not requests.is_empty() else {}
		mutex.unlock()
		if exit_requested:
			break
		if request_data.is_empty():
			continue
		pipe.store_line(request_data.text)
		pipe.flush()
		var line := pipe.get_line()
		mutex.lock()
		exit_requested = stopping
		mutex.unlock()
		if exit_requested:
			break
		var result: Dictionary = {"id": request_data.id, "method": request_data.method}
		if line.to_utf8_buffer().size() > 64 * 1024 * 1024:
			result.error = "Gameplay response exceeds 64 MiB."
		else:
			var decoded: Variant = JSON.parse_string(line)
			if not decoded is Dictionary or int(decoded.get("id", -1)) != int(request_data.id):
				result.error = "The gameplay runtime exited or returned invalid data. Check Node.js 22+."
			elif decoded.get("ok", false):
				result.result = decoded.get("result")
			else:
				var error: Dictionary = decoded.get("error", {})
				result.error = (
					str(error.get("code", "error"))
					+ ": "
					+ str(error.get("message", "Rejected request"))
				)
		mutex.lock()
		replies.append(result)
		mutex.unlock()


func _process(_delta: float) -> void:
	mutex.lock()
	var available: Array[Dictionary] = replies.duplicate()
	replies.clear()
	mutex.unlock()
	for reply in available:
		outstanding = maxi(0, outstanding - 1)
		last_response_id = int(reply.id)
		if reply.has("error"):
			rejected_with_id.emit(last_response_id, reply.error)
			rejected.emit(reply.error)
		else:
			response_with_id.emit(last_response_id, reply.method, reply.get("result"))
			response.emit(reply.method, reply.get("result"))


func stop() -> void:
	mutex.lock()
	stopping = true
	mutex.unlock()
	if process.has("pid") and OS.is_process_running(process.pid):
		OS.kill(process.pid)
	wake.post()
	if thread.is_started():
		thread.wait_to_finish()
	if pipe != null:
		pipe.close()
		pipe = null
	var error_pipe: FileAccess = process.get("stderr")
	if error_pipe != null:
		error_pipe.close()
	process.clear()


func _exit_tree() -> void:
	stop()
