extends MainLoop
## Persistent, local JSON transport. MainLoop deliberately avoids SceneTree autoloads.
const MAX_REQUEST_BYTES: int = 8388608
var _toolbox: GameToolbox
var _stdio: bool = false
var _request_path: String = ""
var _response_path: String = ""
var _finished: bool = false
var _metadata: Dictionary = {}


func _initialize() -> void:
	_metadata = {
		"engine_executed": true,
		"engine": Engine.get_version_info().string,
		"source_revision": "",
		"source_digest": ""
	}
	var options: Dictionary = _options(OS.get_cmdline_user_args())
	if not options.ok:
		_emit(_rejected(options.error.code, options.error.message, options.error.details))
		_finished = true
		return
	_stdio = options.result.stdio
	_request_path = options.result.request
	_response_path = options.result.response
	_metadata.merge(options.result.metadata, true)
	var created: Dictionary = GameToolboxFactory.create(
		options.result.packs, options.result.metadata
	)
	if not created.ok:
		_publish(_rejected(created.error.code, created.error.message, created.error.details))
		_finished = true
		return
	_toolbox = created.toolbox
	if _stdio:
		print(
			"TOOLBOX_READY ",
			JSON.stringify(
				{
					"protocol": GameToolbox.PROTOCOL,
					"version": GameToolbox.VERSION,
					"metadata": _toolbox.metadata()
				}
			)
		)


func _process(_delta: float) -> bool:
	if _finished:
		return true
	if not _stdio:
		_file_request()
		return true
	var line: Dictionary = _read_line()
	if line.eof:
		return true
	if line.bytes.size() > MAX_REQUEST_BYTES:
		_emit(_rejected("REQUEST_LIMIT", "Request exceeds 8 MiB."))
		return true
	if not ContentJson.valid_utf8(line.bytes):
		_emit(_rejected("INVALID_JSON", "The request must contain UTF-8 JSON."))
		return false
	_emit(_execute_text(line.bytes.get_string_from_utf8()))
	return false


func _read_line() -> Dictionary:
	# Byte reads preserve framing and validate encoding before the engine decoder.
	# C stdio buffers the pipe; only this bounded line is retained by the runner.
	var bytes: PackedByteArray = PackedByteArray()
	while bytes.size() <= MAX_REQUEST_BYTES:
		var next: PackedByteArray = OS.read_buffer_from_stdin(1)
		if next.is_empty():
			return {"eof": bytes.is_empty(), "bytes": bytes}
		if next[0] == 10:
			return {"eof": false, "bytes": bytes}
		bytes.append(next[0])
	return {"eof": false, "bytes": bytes}


func _finalize() -> void:
	if _toolbox != null:
		_toolbox.close()
		_toolbox = null


func _file_request() -> void:
	var file: FileAccess = FileAccess.open(_request_path, FileAccess.READ)
	var response: Dictionary
	if file == null:
		response = _rejected("REQUEST_READ", "The request file could not be opened.")
	elif file.get_length() > MAX_REQUEST_BYTES:
		response = _rejected("REQUEST_LIMIT", "Request exceeds 8 MiB.")
	else:
		var bytes: PackedByteArray = file.get_buffer(file.get_length())
		if file.get_error() not in [OK, ERR_FILE_EOF] or not ContentJson.valid_utf8(bytes):
			response = _rejected("INVALID_JSON", "The request must contain complete UTF-8 JSON.")
		else:
			response = _execute_text(bytes.get_string_from_utf8())
	if file != null:
		file.close()
	_publish(response)


func _execute_text(text: String) -> Dictionary:
	var parsed: Dictionary = ContentJson.parse(text, true)
	if not parsed.ok:
		return _rejected("INVALID_JSON", parsed.error)
	if not parsed.data is Dictionary:
		return _rejected("INVALID_REQUEST", "Expected a JSON request object.")
	return _toolbox.execute(parsed.data)


func _rejected(code: String, message: String, details: Dictionary = {}) -> Dictionary:
	var response: Dictionary = {
		"protocol": GameToolbox.PROTOCOL,
		"version": GameToolbox.VERSION,
		"request_id": "",
		"operation": "",
		"session": "",
		"metadata": _toolbox.metadata() if _toolbox != null else _metadata.duplicate(true)
	}
	response.merge(DeveloperToolResult.failure(code, message, details))
	return response


func _publish(response: Dictionary) -> void:
	if not _stdio and not _response_path.is_empty():
		var error: String = Storage.write_compact_json(
			_response_path, response, GameToolbox.MAX_RESPONSE_BYTES
		)
		if not error.is_empty():
			response = _rejected("RESPONSE_WRITE", error)
	_emit(response)


func _emit(response: Dictionary) -> void:
	# Preserve checkpoint floating-point continuation and exact int64 JSON numbers.
	print("TOOLBOX_RESULT ", JSON.stringify(response, "", true, true))


func _options(arguments: PackedStringArray) -> Dictionary:
	var options: Dictionary = {
		"stdio": false, "request": "", "response": "", "packs": [], "metadata": {}
	}
	var seen: Dictionary = {}
	for argument in arguments:
		var key: String = argument.get_slice("=", 0)
		if key != "--pack" and seen.has(key):
			return DeveloperToolResult.failure(
				"INVALID_ARGUMENT", "Duplicate transport argument: " + key
			)
		seen[key] = true
		var value: String = argument.substr(key.length() + 1)
		match key:
			"--toolbox-stdio":
				if argument != key:
					return DeveloperToolResult.failure(
						"INVALID_ARGUMENT", "The stdio flag does not take a value."
					)
				options.stdio = true
			"--toolbox-request":
				options.request = value
			"--toolbox-response":
				options.response = value
			"--pack":
				options.packs.append(value)
			"--source-revision":
				options.metadata.source_revision = value
			"--source-digest":
				options.metadata.source_digest = value
			_:
				return DeveloperToolResult.failure(
					"INVALID_ARGUMENT", "Unknown transport argument: " + key
				)
	return _validated_options(options)


func _validated_options(options: Dictionary) -> Dictionary:
	if options.stdio:
		if options.request != "" or options.response != "":
			return DeveloperToolResult.failure(
				"INVALID_ARGUMENT", "Choose stdio or request/response files."
			)
	elif options.request == "" or options.response == "":
		return DeveloperToolResult.failure(
			"INVALID_ARGUMENT", "Choose distinct request and response files."
		)
	elif _destination_conflicts(options.request, options.response):
		return DeveloperToolResult.failure(
			"INVALID_ARGUMENT", "Request and response paths must be distinct and contain no links."
		)
	return DeveloperToolResult.success(options)


func _destination_conflicts(request_path: String, response_path: String) -> bool:
	var input: String = _absolute_path(request_path)
	var output: String = _absolute_path(response_path)
	if _path_has_links(input) or _path_has_links(output):
		return true
	if OS.has_feature("windows"):
		input = input.to_lower()
		output = output.to_lower()
	# Atomic storage owns its temporary and backup names as well as the destination.
	return input in [output, output + ".tmp", output + ".bak"]


func _absolute_path(path: String) -> String:
	var windows: bool = OS.has_feature("windows")
	var globalized: String = ProjectSettings.globalize_path(_normalized_path(path, windows))
	if globalized.is_relative_path():
		var directory: DirAccess = DirAccess.open(".")
		if directory != null:
			globalized = directory.get_current_dir().path_join(globalized)
	return _normalized_path(globalized, windows)


func _normalized_path(path: String, windows: bool) -> String:
	# Windows accepts either separator, including mixed spelling of the same file.
	# Convert before simplify_path so dot segments and storage suffixes compare alike.
	return (path.replace("\\", "/") if windows else path).simplify_path()


func _path_has_links(path: String) -> bool:
	var cursor: String = path
	while not cursor.is_empty():
		var parent: String = cursor.get_base_dir()
		var directory: DirAccess = DirAccess.open(parent)
		if directory != null and directory.is_link(cursor.get_file()):
			return true
		if parent == cursor:
			break
		cursor = parent
	return false
