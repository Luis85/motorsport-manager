class_name SettingsView
extends VBoxContainer
## A staged presentation preference draft. Persistence belongs to the scene shell.
signal save_requested(draft: Dictionary)
signal back_requested
var draft: Dictionary = {}
var original: Dictionary = {}
var data_path = ""
var columns: GridContainer
var notice: Label
var save_button: Button
var back_button: Button
var text_choice: OptionButton
var layout_choice: OptionButton
var advanced_choice: OptionButton
var racing_line_choice: CheckButton
var advanced_layout = "director"
var sample: Label
var scroll: ScrollContainer


func configure(value: Dictionary, path: String) -> void:
	original = value.duplicate(true)
	draft = value.duplicate(true)
	data_path = path
	var saved_layout = str(draft.get("pitwall_layout", "minimal"))
	var preferred = str(draft.get("advanced_pitwall_layout", saved_layout))
	advanced_layout = "director"
	if saved_layout in ["director", "engineering"]:
		advanced_layout = saved_layout
	if preferred in ["director", "engineering"]:
		advanced_layout = preferred
	# Normalize pre-selector application dictionaries without creating a false
	# unsaved-change banner merely by opening Settings.
	if not original.has("advanced_pitwall_layout"):
		original.advanced_pitwall_layout = advanced_layout
		draft.advanced_pitwall_layout = advanced_layout


func _ready() -> void:
	theme = UI.theme()
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	add_child(UI.label("Settings", 28))
	add_child(UI.paragraph("Preview your interface preferences. Nothing is saved until Apply."))
	scroll = ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	add_child(scroll)
	var body = UI.vbox(scroll, true)
	columns = GridContainer.new()
	columns.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.add_child(columns)
	_build_display()
	_build_circuit()
	_sync_layout_controls()
	_build_data(body)
	var footer = UI.panel()
	add_child(footer)
	var actions = UI.hbox(footer)
	back_button = UI.button("Back", func(): confirm_discard(func(): back_requested.emit()))
	actions.add_child(back_button)
	notice = UI.paragraph("No unsaved changes.")
	actions.add_child(notice)
	save_button = UI.button(
		"Apply and save settings", func(): save_requested.emit(draft.duplicate(true)), true
	)
	actions.add_child(save_button)
	for button in [back_button, save_button]:
		button.custom_minimum_size.y = GameTheme.ACTION_HEIGHT
	resized.connect(_layout)
	_layout()
	_scale()
	_update_status()
	PitwallDesign.focus_later(text_choice)


func _section(title: String) -> VBoxContainer:
	var panel = UI.panel()
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	columns.add_child(panel)
	var body = UI.vbox(panel)
	body.add_child(UI.label(title, 14, UI.ACCENT))
	return body


func _build_display() -> void:
	var body = _section("INTERFACE & DISPLAY")
	text_choice = UI.option(
		["100%", "115%", "130%"],
		func(index):
			_change("pitwall_text_scale", PitwallDesign.TEXT_SCALES[index])
			_scale(),
		PitwallDesign.TEXT_SCALES.find(draft.get("pitwall_text_scale", 1.0))
	)
	text_choice.tooltip_text = (
		"Scales menus, editor controls, dialogs and the pitwall. Illustrated map labels "
		+ "keep their own scale."
	)
	text_choice.accessibility_name = "Interface text size"
	UI.field(body, "Interface text", text_choice)
	layout_choice = UI.option(
		["Minimal", "Advanced"],
		_set_layout,
		0 if draft.get("pitwall_layout", "minimal") == "minimal" else 1
	)
	layout_choice.tooltip_text = (
		"Minimal keeps the focused race screen. Advanced opens Race Director and the "
		+ "full engineering workspaces. The choice applies when a weekend screen next "
		+ "opens."
	)
	layout_choice.accessibility_name = "Race interface"
	UI.field(body, "Race interface", layout_choice)
	advanced_choice = UI.option(
		["Race Director", "Engineering"],
		_set_advanced_layout,
		0 if advanced_layout == "director" else 1
	)
	advanced_choice.tooltip_text = (
		"Race Director is the approachable advanced starting view. Engineering opens the "
		+ "complete technical workspace directly; both use the same live weekend."
	)
	advanced_choice.accessibility_name = "Advanced interface starting view"
	UI.field(body, "Advanced starts in", advanced_choice)
	sample = UI.label("Preview · MER · Box this lap", 14)
	body.add_child(sample)
	body.add_child(
		UI.check("Fullscreen", draft.fullscreen, func(value): _change("fullscreen", value))
	)
	body.add_child(
		UI.check("Vertical synchronization", draft.vsync, func(value): _change("vsync", value))
	)
	UI.field(
		body,
		"Default simulation speed",
		UI.option(
			["1×", "2×", "4×", "8×", "16×"],
			func(index): _change("speed", [1, 2, 4, 8, 16][index]),
			[1, 2, 4, 8, 16].find(draft.speed)
		)
	)
	body.add_child(
		UI.paragraph(
			(
				"Minimal remains the default. Changing interface mode alters presentation only: "
				+ "the weekend, commands, playback state, inventory and random state stay "
				+ "authoritative and shared."
			)
		)
	)


func _build_circuit() -> void:
	var body = _section("CIRCUIT PRESENTATION")
	UI.field(
		body,
		"Scenery detail",
		UI.option(
			["Rich illustration", "Simple / fewer trees"],
			func(index): _change("scenery_detail", ["rich", "simple"][index]),
			0 if draft.scenery_detail == "rich" else 1
		)
	)
	UI.field(
		body,
		"Car dot size",
		UI.option(
			["Standard", "Large", "Extra large"],
			func(index): _change("dot_scale", [1.0, 1.3, 1.6][index]),
			[1.0, 1.3, 1.6].find(draft.dot_scale)
		)
	)
	body.add_child(
		UI.check(
			"Show driver labels by default", draft.labels, func(value): _change("labels", value)
		)
	)
	racing_line_choice = UI.check(
		"Show racing line by default", draft.racing_line, func(value): _change("racing_line", value)
	)
	racing_line_choice.tooltip_text = (
		"Available in the Advanced interface. Minimal deliberately keeps engineering "
		+ "overlays hidden."
	)
	body.add_child(racing_line_choice)
	body.add_child(
		UI.check(
			"Reduced motion / direct follow camera",
			draft.reduced_motion,
			func(value): _change("reduced_motion", value)
		)
	)
	body.add_child(
		UI.paragraph(
			(
				"These preferences change presentation, never grip, weather or the race model. "
				+ "Circuit defaults apply when a view opens."
			)
		)
	)


func _build_data(parent: Node) -> void:
	var panel = UI.panel()
	parent.add_child(panel)
	var body = UI.vbox(panel)
	body.add_child(UI.label("LOCAL DATA", 14, UI.ACCENT))
	body.add_child(
		UI.paragraph(
			(
				"Tracks, settings and the active weekend are stored on this device. Saves retain "
				+ "the previous file as .bak; bundled circuits are never overwritten."
			)
		)
	)
	body.add_child(UI.paragraph(data_path))
	var actions = UI.hbox(body)
	actions.add_child(
		UI.button(
			"Copy data path",
			func():
				DisplayServer.clipboard_set(data_path)
				notice.text = "Data path copied to clipboard.",
		)
	)
	actions.add_child(
		UI.button(
			"Open data folder",
			func():
				var error = OS.shell_open(data_path)
				if error != OK:
					UI.notify(
						self,
						"Could not open folder",
						"Use Copy data path to open it manually. Error: " + error_string(error)
					),
		)
	)


func _set_layout(index: int) -> void:
	_change("pitwall_layout", "minimal" if index == 0 else advanced_layout)
	_sync_layout_controls()


func _set_advanced_layout(index: int) -> void:
	advanced_layout = ["director", "engineering"][index]
	_change("advanced_pitwall_layout", advanced_layout)
	if draft.get("pitwall_layout", "minimal") != "minimal":
		_change("pitwall_layout", advanced_layout)


func _sync_layout_controls() -> void:
	var minimal = draft.get("pitwall_layout", "minimal") == "minimal"
	if advanced_choice != null:
		advanced_choice.disabled = minimal
	if racing_line_choice != null:
		racing_line_choice.disabled = minimal


func _change(key: String, value: Variant) -> void:
	draft[key] = value
	_update_status()


func _scale() -> void:
	var factor = float(draft.get("pitwall_text_scale", 1.0))
	set_meta("pitwall_text_scale", factor)
	PitwallDesign.scale_controls(self, factor)


func _layout() -> void:
	if columns:
		columns.columns = 2 if size.x >= 1200 else 1


func has_changes() -> bool:
	return draft != original


func _update_status() -> void:
	if not notice:
		return
	notice.text = (
		"Unsaved changes · Apply to keep them." if has_changes() else "No unsaved changes."
	)
	notice.add_theme_color_override("font_color", UI.MUTED)
	save_button.disabled = not has_changes()


func save_result(error: String) -> void:
	if error.is_empty():
		original = draft.duplicate(true)
		_update_status()
		notice.text = "Settings saved."
	else:
		notice.text = "Not saved: " + error + " Your changes are still here."
		notice.add_theme_color_override("font_color", UI.DANGER)
		save_button.disabled = false


func confirm_discard(callback: Callable) -> void:
	if not has_changes():
		callback.call()
		return
	UI.confirm(
		self,
		"Discard unsaved settings?",
		"Your preview has not been saved. Stay here to Apply, or discard these changes.",
		"Discard changes",
		callback
	)
