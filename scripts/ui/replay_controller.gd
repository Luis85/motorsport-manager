class_name ReplayController
extends Node
## Preserve the actual original view and drafts; no source time/selection/RNG writes.
var host: Control
var workspace: ReplayWorkspace
var suspended: Array = []
var previous_focus: WeakRef
var previous_header = false

func configure(main: Control) -> void: host = main

func open_current() -> void:
	var record = App.ensure_recording()
	if record == null: UI.notify(host, "Replay unavailable", "Start or resume a native weekend first."); return
	open_data(record.seal())

func open_data(data: Variant) -> String:
	if workspace != null: return "Close the current replay first."
	if data is Dictionary and data.get("kind") == ReplayStorage.SESSION_KIND: data = data.get("record")
	var player = RaceReplay.new(); var error = player.load_record(data) if data is Dictionary else "The file does not contain a recording."
	if not error.is_empty(): return error
	var focus = host.get_viewport().gui_get_focus_owner()
	previous_focus = weakref(focus) if focus else null
	previous_header = host.global_header.visible; host.global_header.hide()
	for child in host.content.get_children():
		if child.is_queued_for_deletion(): continue
		suspended.append({"node": child, "visible": child.visible, "process": child.process_mode})
		child.hide(); child.process_mode = Node.PROCESS_MODE_DISABLED
	workspace = ReplayWorkspace.new(); workspace.configure(player); host.content.add_child(workspace)
	workspace.close_requested.connect(close)
	return ""

func close() -> void:
	if workspace == null: return
	workspace.process_mode = Node.PROCESS_MODE_DISABLED
	host.content.remove_child(workspace); workspace.queue_free(); workspace = null
	for saved in suspended:
		if is_instance_valid(saved.node): saved.node.visible = saved.visible; saved.node.process_mode = saved.process
	suspended.clear(); host.global_header.visible = previous_header
	if previous_focus and is_instance_valid(previous_focus.get_ref()): PitwallDesign.focus_later(previous_focus.get_ref())

func import_record() -> void:
	var dialog = FileDialog.new(); dialog.title = "Open recording or scenario · observation only"
	dialog.file_mode = FileDialog.FILE_MODE_OPEN_FILE; dialog.access = FileDialog.ACCESS_FILESYSTEM
	dialog.filters = PackedStringArray(["*.json ; Race recording / scenario / session"]); host.add_child(dialog)
	dialog.file_selected.connect(func(path):
		var read = Storage.read_json(path)
		var error = open_data(read.data) if read.ok else read.error
		if not error.is_empty(): UI.notify(host, "Recording not opened", error)
		dialog.queue_free())
	dialog.canceled.connect(dialog.queue_free); dialog.popup_centered(Vector2i(800,520))

func resume_sandbox() -> void:
	var read = Storage.read_json(App.sandbox_path)
	if not read.ok: UI.notify(host, "Sandbox not resumed", read.error); return
	var loaded = ReplayStorage.restore_session(read.data, true)
	if not loaded.ok: UI.notify(host, "Sandbox not resumed", loaded.error); return
	var error = open_data(read.data.record)
	if not error.is_empty(): UI.notify(host, "Sandbox not resumed", error); return
	workspace.mount_sandbox(loaded.sim, loaded.record)
