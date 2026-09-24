class_name NotebookWindow
extends Window
## Historical facts and personal interpretation remain separate from race authority.
var record: RaceRecord
var storage_path = CircuitNotebook.PATH
var ledger: Dictionary = CircuitNotebook.empty()
var selected: Dictionary = {}
var source_hash = ""
var invoker: WeakRef
var filter: OptionButton
var runs: ItemList
var details: Label
var note: TextEdit
var counter: Label
var notice: Label
var remember_button: Button
var save_button: Button
var forget_button: Button
var export_button: Button
var close_button: Button
var guard: ConfirmationDialog
var data_valid = true
var status_clock = 0.0
var activity: Label

static func open(parent: Node, source: RaceRecord = null, path: String = CircuitNotebook.PATH, return_focus: Control = null) -> NotebookWindow:
	var window = NotebookWindow.new()
	window.record = source; window.storage_path = path
	var focused = return_focus if return_focus else parent.get_viewport().gui_get_focus_owner()
	if focused: window.invoker = weakref(focused)
	parent.add_child(window)
	window.popup_centered(Vector2i(980, 640))
	PitwallDesign.focus_later(window.close_button)
	return window

func _ready() -> void:
	set_meta("circuit_notebook", true)
	title = "Circuit notebook · local observations"
	theme = UI.theme(); transient = true; exclusive = true
	min_size = Vector2i(900, 580)
	var margin = MarginContainer.new(); add_child(margin); margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right", "top", "bottom"]: margin.add_theme_constant_override("margin_" + side, 12)
	var body = UI.vbox(margin, true)
	body.add_child(UI.label("REMEMBER THE DECISION, NOT A BONUS", 17, UI.ACCENT))
	var header = UI.hbox(body)
	remember_button = UI.button("Remember completed run", remember, true); header.add_child(remember_button)
	activity = UI.paragraph("Opt-in history. No rewards, car upgrades or forecast changes."); header.add_child(activity)
	var columns = UI.hbox(body, true)
	var left = UI.vbox(columns, true); left.custom_minimum_size.x = 255; left.size_flags_stretch_ratio = 0.42
	filter = UI.option(["All recorded circuits", "This exact circuit snapshot"], request_filter)
	left.add_child(filter)
	runs = ItemList.new(); runs.size_flags_vertical = Control.SIZE_EXPAND_FILL
	runs.fixed_column_width = 240; runs.max_columns = 1
	runs.item_selected.connect(request_selection); left.add_child(runs)
	var right = UI.vbox(columns, true)
	var scroll = ScrollContainer.new(); scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED; scroll.follow_focus = true; right.add_child(scroll)
	details = UI.paragraph("No run selected.", UI.INK); scroll.add_child(details)
	right.add_child(UI.paragraph("Your note · interpretation, not measured data", UI.INK))
	note = TextEdit.new(); note.custom_minimum_size.y = 110; note.wrap_mode = TextEdit.LINE_WRAPPING_BOUNDARY
	note.text_changed.connect(edit_changed); right.add_child(note)
	counter = UI.label(""); right.add_child(counter)
	notice = UI.paragraph(""); body.add_child(notice)
	var footer = UI.hbox(body)
	save_button = UI.button("Save note", save_note, true); footer.add_child(save_button)
	forget_button = UI.button("Forget entry…", request_forget); footer.add_child(forget_button)
	export_button = UI.button("Export notebook…", export_notebook); footer.add_child(export_button)
	var spacer = Control.new(); spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL; footer.add_child(spacer)
	close_button = UI.button("Close notebook", request_close); footer.add_child(close_button)
	close_requested.connect(request_close)
	if record != null and record.source != null and record.source.get_ref() != null:
		source_hash = RaceRecord.fingerprint(record.source.get_ref().track.document)
	filter.set_item_disabled(1, source_hash.is_empty())
	PitwallDesign.scale_controls(self, float(App.settings.pitwall_text_scale))
	reload()

func dirty() -> bool:
	return not selected.is_empty() and note.text != selected.note

func reload(prefer: String = "") -> void:
	var loaded = CircuitNotebook.read(storage_path)
	data_valid = loaded.ok
	if not loaded.ok:
		notice.text = loaded.error; export_button.disabled = true; remember_button.disabled = true
		ledger = CircuitNotebook.empty(); refill(); return
	ledger = loaded.data; export_button.disabled = false
	var sim = record.source.get_ref() if record != null and record.source != null else null
	remember_button.disabled = sim == null or sim.phase != "results"
	notice.text = "%d / %d runs retained. Remember is available after a completed original or sandbox weekend." % [ledger.entries.size(), CircuitNotebook.MAX_ENTRIES]
	refill(prefer)

func refill(prefer: String = "") -> void:
	runs.clear(); selected = {}
	for i in range(ledger.entries.size() - 1, -1, -1):
		var entry = ledger.entries[i]
		var f = entry.facts
		if filter.selected == 1 and f.track_hash != source_hash: continue
		var label = "%s · %s · %s" % [f.origin.capitalize(), f.event_id.left(6), f.track_name]
		var index = runs.add_item(label); runs.set_item_metadata(index, f.event_id)
		runs.set_item_tooltip(index, label + " · " + f.context.vehicle + " · " + str(int(f.context.laps)) + " laps")
	if runs.item_count > 0:
		var index = 0
		for i in range(runs.item_count):
			if runs.get_item_metadata(i) == prefer: index = i; break
		select_run(index)
	else:
		details.text = "No remembered runs for this view.\n\nComplete a weekend or a sandbox, then explicitly remember it here. Existing saves and accepted receipts are not silently imported."
		note.text = ""; edit_changed()

func select_run(index: int) -> void:
	if index < 0 or index >= runs.item_count: return
	var id = runs.get_item_metadata(index)
	for entry in ledger.entries:
		if entry.facts.event_id == id:
			selected = entry.duplicate(true); break
	runs.select(index); details.text = NotebookEntry.describe(selected)
	note.text = selected.note; edit_changed()

func request_selection(index: int) -> void:
	if not dirty(): select_run(index); return
	for i in range(runs.item_count):
		if runs.get_item_metadata(i) == selected.facts.event_id: runs.select(i); break
	confirm_discard(func(): select_run(index))

func request_filter(index: int) -> void:
	var old = int(filter.get_meta("previous_filter", 0))
	filter.select(old)
	confirm_discard(func():
		filter.select(index); filter.set_meta("previous_filter", index); refill())

func edit_changed() -> void:
	note.editable = not selected.is_empty()
	counter.text = "%d / 1,200 characters · %s" % [note.text.length(), "Unsaved note" if dirty() else "Saved / unchanged"]
	save_button.disabled = not dirty() or note.text.length() > NotebookEntry.MAX_NOTE
	forget_button.disabled = selected.is_empty()

func remember() -> void:
	confirm_discard(func():
		var saved = CircuitNotebook.remember(record, storage_path)
		if not saved.ok: notice.text = saved.error; return
		reload(saved.entry.facts.event_id)
		notice.text = "Already remembered; existing note kept." if saved.already_recorded else "Observed result remembered. No race state or reward changed.")

func save_note() -> void:
	if selected.is_empty(): return
	var saved = CircuitNotebook.save_note(selected.facts.event_id, note.text, int(selected.revision), storage_path)
	if not saved.ok: notice.text = saved.error; return
	selected = saved.entry; reload(selected.facts.event_id)
	notice.text = "Personal note saved separately from the observed facts."

func confirm_discard(action: Callable) -> void:
	if not dirty(): action.call(); return
	confirm_action("Discard unsaved note?", "The note has not been saved. Stay to save it, or discard only this draft.", "Discard draft", action)

func confirm_action(heading: String, message: String, accept: String, action: Callable) -> void:
	if is_instance_valid(guard): return
	guard = ConfirmationDialog.new(); guard.title = heading; guard.dialog_text = message
	guard.ok_button_text = accept; guard.cancel_button_text = "Stay and review"
	add_child(guard); PitwallDesign.scale_controls(guard, float(App.settings.pitwall_text_scale))
	guard.confirmed.connect(func(): guard.queue_free(); action.call())
	guard.canceled.connect(func(): guard.queue_free(); PitwallDesign.focus_later(note))
	guard.popup_centered(Vector2i(620, 180)); PitwallDesign.focus_later(guard.get_cancel_button())

func request_forget() -> void:
	if selected.is_empty(): return
	var id = selected.facts.event_id; var revision = int(selected.revision)
	confirm_action("Forget this notebook entry?", "Only this observation and personal note will be removed. Original saves, recordings and accepted results remain untouched.", "Forget entry", func():
		var result = CircuitNotebook.forget(id, revision, storage_path)
		if not result.ok: notice.text = result.error; return
		reload(); notice.text = "Notebook entry forgotten. Original saves and results are unchanged.")

func export_notebook() -> void:
	var loaded = CircuitNotebook.read(storage_path)
	if not loaded.ok: notice.text = loaded.error; return
	var data = loaded.data
	var dialog = FileDialog.new(); dialog.title = "Export saved notebook · unsaved draft excluded"
	dialog.file_mode = FileDialog.FILE_MODE_SAVE_FILE; dialog.access = FileDialog.ACCESS_FILESYSTEM
	dialog.filters = PackedStringArray(["*.json ; Circuit notebook"]); dialog.current_file = "circuit-notebook.json"; add_child(dialog)
	dialog.file_selected.connect(func(path):
		var error = Storage.write_json(path, data)
		notice.text = "Saved notebook exported; any unsaved note draft is still separate." if error.is_empty() else error
		dialog.queue_free(); PitwallDesign.focus_later(export_button))
	dialog.canceled.connect(func(): dialog.queue_free(); PitwallDesign.focus_later(export_button))
	PitwallDesign.scale_controls(dialog, float(App.settings.pitwall_text_scale)); dialog.popup_centered(Vector2i(800, 520))

func request_close() -> void:
	confirm_discard(func():
		hide(); queue_free()
		if invoker and is_instance_valid(invoker.get_ref()): PitwallDesign.focus_later(invoker.get_ref()))

func _unhandled_key_input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo: return
	for window in get_embedded_subwindows():
		if window.visible: return
	if event.keycode == KEY_ESCAPE: request_close(); set_input_as_handled()

func _process(delta: float) -> void:
	status_clock += delta
	if status_clock < 0.25: return
	status_clock = 0.0
	var sim = record.source.get_ref() if record != null and record.source != null else null
	remember_button.disabled = not data_valid or sim == null or sim.phase != "results"
	activity.text = "Local history never changes performance. " + ("Live weekend keeps running." if sim != null and sim.phase in RaceSim.ACTIVE and not sim.paused else "Originals and experiments stay labeled; no rewards.")
