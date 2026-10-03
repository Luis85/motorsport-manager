extends MainLoop
## Persistent, local JSON transport. MainLoop deliberately avoids SceneTree autoloads.
const MAX_REQUEST_BYTES: int = 8388608
var _toolbox: GameToolbox
var _stdio: bool = false
var _request_path: String = ""
var _response_path: String = ""
var _finished: bool = false


func _initialize() -> void:
	var options: Dictionary = _options(OS.get_cmdline_user_args())
	if not options.ok:
		_emit(options)
		_finished = true
		return
	_stdio = options.result.stdio
	_request_path = options.result.request
	_response_path = options.result.response
	var created: Dictionary = GameToolboxFactory.create(
		options.result.packs, options.result.metadata
	)
	if not created.ok:
		_emit(created)
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
	# fgets bounds the native allocation and consumes one line, including large snapshots.
	var line: String = OS.read_string_from_stdin(MAX_REQUEST_BYTES + 2)
	if line.is_empty():
		return true
	if line.to_utf8_buffer().size() > MAX_REQUEST_BYTES:
		_emit(_rejected("REQUEST_LIMIT", "Request exceeds 8 MiB."))
		return true
	_emit(_execute_text(line))
	return false


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
	var error: String = Storage.write_json(_response_path, response)
	if not error.is_empty():
		response = _rejected("RESPONSE_WRITE", error)
	_emit(response)


func _execute_text(text: String) -> Dictionary:
	var parsed: Dictionary = ContentJson.parse(text, true)
	if not parsed.ok:
		return _rejected("INVALID_JSON", parsed.error)
	if not parsed.data is Dictionary:
		return _rejected("INVALID_REQUEST", "Expected a JSON request object.")
	return _toolbox.execute(parsed.data)


func _rejected(code: String, message: String) -> Dictionary:
	var response: Dictionary = {
		"protocol": GameToolbox.PROTOCOL,
		"version": GameToolbox.VERSION,
		"request_id": "",
		"operation": "",
		"session": "",
		"metadata": _toolbox.metadata() if _toolbox != null else {}
	}
	response.merge(DeveloperToolResult.failure(code, message))
	return response


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
	if options.stdio:
		if options.request != "" or options.response != "":
			return DeveloperToolResult.failure(
				"INVALID_ARGUMENT", "Choose stdio or request/response files."
			)
	elif options.request == "" or options.response == "" or options.request == options.response:
		return DeveloperToolResult.failure(
			"INVALID_ARGUMENT", "Choose distinct request and response files."
		)
	return DeveloperToolResult.success(options)
