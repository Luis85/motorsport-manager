class_name MinimalRaceWorkspace
extends VBoxContainer
## A new, small race screen. Does not construct/inherit Director or Engineering UI.
signal menu_requested
signal new_weekend_requested
var session: MinimalRaceSession
var frame: Dictionary = {}
var session_runner: RaceSessionRunner
var recording: RaceRecord
var controls: MinimalRaceControls
var toolbar: PanelContainer
var body: HBoxContainer
var timing_panel: PanelContainer
var pitwall: PanelContainer
var canvas: TrackCanvas
var tower: Tree
var items_by_id: Dictionary = {}
var driver_cards: Dictionary = {}
var driver_row: HBoxContainer
var timing_caption: Label
var playback_label: Label
var engine_target_id = -1
var engine_target_phase = ""
var rank_rows: Array[TreeItem] = []
var rendered_rows: Dictionary = {}
var driver_buttons: Dictionary = {}
var selected_id = 3
var session_label: Label
var clock_label: Label
var pit_identity: Label
var engine_description: Label
var timing_stack: VBoxContainer
var pit_masthead: HBoxContainer
var pit_selected_panel: PanelContainer
var pit_right: VBoxContainer
var name_label: Label
var state_label: Label
var hint_label: Label
var receipt_label: Label
var pace_label: Label
var pause_button: Button
var play_button: Button
var speed_control: OptionButton
var primary_button: Button
var send_button: Button
var box_button: Button
var push_button: Button
var calm_button: Button
var engine_control: OptionButton
var text_scale = 1.0
var preferences: Dictionary = {}
var refresh_clock = 0.0
var last_phase = ""
var table_updates = 0
var receipts: Dictionary = {}
var global_message = ""
var ready_to_draw = false
var compact_profile = -1

func configure(value: MinimalRaceSession, options: Dictionary = {}) -> void:
	preferences = options.duplicate(true)
	session = value
	controls = value.controls
	session_runner = value.runner
	frame = value.query.capture()
	selected_id = value.selected_driver()

func _ready() -> void:
	text_scale = float(preferences.get("pitwall_text_scale", 1.0))
	theme = MinimalRaceStyle.theme(text_scale)
	size_flags_horizontal = Control.SIZE_EXPAND_FILL; size_flags_vertical = Control.SIZE_EXPAND_FILL
	add_theme_constant_override("separation", 8)
	build_toolbar(); build_body(); build_driver_row()
	last_phase = frame.phase; ready_to_draw = true
	get_viewport().size_changed.connect(func(): call_deferred("refresh"))
	refresh(); canvas.call_deferred("fit")
	play_button.call_deferred("grab_focus")

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), MinimalRaceStyle.BG)

func label(text: String, points: int = 14, muted: bool = false) -> Label:
	return MinimalRaceStyle.label(text, points, text_scale, muted)

func button(text: String, callback: Callable, toggle: bool = false) -> Button:
	return MinimalRaceStyle.button(text, callback, text_scale, toggle)

func build_toolbar() -> void:
	toolbar = PanelContainer.new(); toolbar.add_theme_stylebox_override("panel", MinimalRaceStyle.surface(MinimalRaceStyle.PANEL, MinimalRaceStyle.LINE, roundi(9 * text_scale))); add_child(toolbar)
	var row = HBoxContainer.new(); toolbar.add_child(row)
	var menu_button = button("Menu", func(): menu_requested.emit()); row.add_child(menu_button)
	menu_button.tooltip_text = "Pause, save this weekend and return to the menu."
	var identity = VBoxContainer.new(); identity.add_theme_constant_override("separation", 1); row.add_child(identity)
	session_label = label("WEEKEND", 11, true); identity.add_child(session_label)
	clock_label = label("Ready", 18); identity.add_child(clock_label)
	var spacer = Control.new(); spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL; row.add_child(spacer)
	playback_label = label("Paused", 12, true); row.add_child(playback_label)
	pause_button = button("Pause", func(): controls.pause(); refresh(), true); row.add_child(pause_button)
	play_button = button("Play", func(): controls.play(); refresh(), true); row.add_child(play_button)
	pause_button.tooltip_text = "Pause simulation · Space"; play_button.tooltip_text = "Run at the selected speed · Space"
	speed_control = OptionButton.new(); speed_control.custom_minimum_size = Vector2(70 * text_scale, 36 * text_scale)
	for speed in [1,2,4,8,16]: speed_control.add_item(str(speed) + "×", speed)
	speed_control.item_selected.connect(func(index): controls.set_speed(speed_control.get_item_id(index)); refresh())
	speed_control.accessibility_name = "Simulation speed"; row.add_child(speed_control)
	primary_button = button("Start practice", advance_stage); MinimalRaceStyle.primary(primary_button, text_scale); row.add_child(primary_button)

func build_body() -> void:
	body = HBoxContainer.new(); body.size_flags_vertical = Control.SIZE_EXPAND_FILL; add_child(body)
	timing_panel = PanelContainer.new(); timing_panel.custom_minimum_size.x = 270 * text_scale; body.add_child(timing_panel)
	var left = VBoxContainer.new(); timing_stack = left; timing_panel.add_child(left)
	var tower_heading = HBoxContainer.new(); left.add_child(tower_heading)
	var tower_title = label("Timing", 16); tower_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL; tower_heading.add_child(tower_title)
	timing_caption = label("", 11, true); tower_heading.add_child(timing_caption)
	tower = Tree.new(); tower.hide_root = true; tower.columns = 4; tower.select_mode = Tree.SELECT_ROW
	tower.column_titles_visible = true; tower.size_flags_vertical = Control.SIZE_EXPAND_FILL
	tower.add_theme_stylebox_override("panel", UI.box(MinimalRaceStyle.PANEL, Color.TRANSPARENT, 0, 0))
	tower.add_theme_stylebox_override("selected", MinimalRaceStyle.surface(MinimalRaceStyle.SELECTED, MinimalRaceStyle.ACCENT, 0))
	tower.add_theme_stylebox_override("selected_focus", tower.get_theme_stylebox("selected"))
	tower.add_theme_constant_override("v_separation", roundi((1 if get_viewport_rect().size.y <= 760 else 5) * text_scale))
	tower.add_theme_constant_override("indent", 0)
	tower.add_theme_font_size_override("font_size", roundi(13 * text_scale))
	tower.add_theme_font_size_override("title_button_font_size", roundi(11 * text_scale))
	tower.add_theme_color_override("title_button_color", MinimalRaceStyle.MUTED)
	for column in range(4):
		tower.set_column_title(column, ["P", "DRIVER", "TIME", "STATE"][column])
		tower.set_column_expand(column, column == 2)
		tower.set_column_title_alignment(column, HORIZONTAL_ALIGNMENT_RIGHT if column == 2 else HORIZONTAL_ALIGNMENT_CENTER)
		tower.set_column_custom_minimum_width(column, [32, 64, 94, 44][column] * text_scale)
		for state in ["normal", "hover", "pressed"]: tower.add_theme_stylebox_override("title_button_" + state, UI.box(MinimalRaceStyle.PANEL, Color.TRANSPARENT, 0, 2))
	left.add_child(tower); var root_item = tower.create_item()
	for car in frame.cars:
		var item = tower.create_item(root_item)
		item.set_metadata(0, car.id); items_by_id[car.id] = item; rank_rows.append(item)
		item.set_text_alignment(0, HORIZONTAL_ALIGNMENT_CENTER)
		item.set_text_alignment(2, HORIZONTAL_ALIGNMENT_RIGHT)
		item.set_text_alignment(3, HORIZONTAL_ALIGNMENT_CENTER)
		item.set_custom_font_size(3, roundi(10 * text_scale))
	tower.item_selected.connect(func():
		var item = tower.get_selected()
		if item and controls.owned(int(item.get_metadata(0))): select_driver(int(item.get_metadata(0))))
	tower.accessibility_name = "Timing tower; your drivers are marked with an asterisk"
	left.add_child(label("* Your team   ~ Estimated gap", 11, true))
	canvas = TrackCanvas.new(); canvas.configure_presentation(preferences); canvas.visual_source = session.visual_source; canvas.show_grid = false; canvas.show_line = false; canvas.show_surface = false; canvas.show_labels = preferences.get("labels", true)
	canvas.fit_padding = Vector2(36,36); canvas.set_track(session.visual_source.detached_track())
	var circuit = VBoxContainer.new(); circuit.size_flags_horizontal = Control.SIZE_EXPAND_FILL; circuit.size_flags_vertical = Control.SIZE_EXPAND_FILL
	circuit.add_theme_constant_override("separation", 6); body.add_child(circuit)
	var title = HBoxContainer.new(); circuit.add_child(title)
	var track_name = label(frame.track.document.name, 13, true); track_name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	track_name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS; title.add_child(track_name)
	title.add_child(label("F · Fit view", 11, true))
	circuit.add_child(canvas)
	canvas.car_selected.connect(func(id):
		if controls.owned(id): select_driver(id))
	canvas.tooltip_text = frame.track.document.name + " · Wheel to zoom; drag with the middle mouse button to pan; F to fit."
	build_pitwall()

func build_pitwall() -> void:
	pitwall = PanelContainer.new()
	pitwall.add_theme_stylebox_override("panel", MinimalRaceStyle.surface(MinimalRaceStyle.PANEL, MinimalRaceStyle.LINE, roundi(10 * text_scale)))
	pitwall.custom_minimum_size.x = 244 * text_scale; body.add_child(pitwall)
	var right = VBoxContainer.new(); pit_right = right
	right.add_theme_constant_override("separation", roundi(7 * text_scale)); pitwall.add_child(right)
	var masthead = HBoxContainer.new(); pit_masthead = masthead; right.add_child(masthead)
	var title = label("PITWALL", 11, true); title.size_flags_horizontal = Control.SIZE_EXPAND_FILL; masthead.add_child(title)
	masthead.add_child(label("MANUAL", 10, true))
	var choices = HBoxContainer.new(); choices.add_theme_constant_override("separation", 3); right.add_child(choices)
	for car in frame.cars:
		if not car.player: continue
		var id = int(car.id)
		var choice = button(car.short, func(): select_driver(id), true)
		choice.size_flags_horizontal = Control.SIZE_EXPAND_FILL; choice.tooltip_text = car.name
		choice.accessibility_name = "Select " + car.name; choices.add_child(choice); driver_buttons[id] = choice
	var selected_panel = PanelContainer.new(); pit_selected_panel = selected_panel
	selected_panel.add_theme_stylebox_override("panel", MinimalRaceStyle.surface(Color("1e3036"), Color.TRANSPARENT, roundi(8*text_scale))); right.add_child(selected_panel)
	var selected_row = HBoxContainer.new(); selected_panel.add_child(selected_row)
	pit_identity = label("", 22); selected_row.add_child(pit_identity)
	var names = VBoxContainer.new(); names.add_theme_constant_override("separation", 0); names.size_flags_horizontal = Control.SIZE_EXPAND_FILL; selected_row.add_child(names)
	name_label = label("", 14); names.add_child(name_label)
	state_label = label("", 11, true); names.add_child(state_label)
	right.add_child(label("PIT OPERATIONS", 10, true))
	var pit_actions = HBoxContainer.new(); pit_actions.add_theme_constant_override("separation", roundi(5*text_scale)); right.add_child(pit_actions)
	send_button = button("Send out", func(): driver_action("send")); pit_actions.add_child(send_button)
	box_button = button("Box this lap", func(): driver_action("box")); pit_actions.add_child(box_button)
	for node in [send_button, box_button]:
		node.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		for state in ["normal","hover","pressed","disabled"]:
			var style = node.get_theme_stylebox(state).duplicate()
			style.content_margin_left = 6*text_scale; style.content_margin_right = 6*text_scale
			node.add_theme_stylebox_override(state,style)
	pace_label = label("Pace · Normal", 12, true); right.add_child(pace_label)
	var pace_row = HBoxContainer.new(); pace_row.add_theme_constant_override("separation", roundi(5*text_scale)); right.add_child(pace_row)
	push_button = button("Push", func(): driver_action("push"), true); pace_row.add_child(push_button)
	calm_button = button("Calm", func(): driver_action("calm"), true); pace_row.add_child(calm_button)
	for node in [push_button,calm_button]: node.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	right.add_child(label("ENGINE MODE", 10, true))
	engine_control = OptionButton.new(); engine_control.custom_minimum_size.y = 36 * text_scale
	for text in ["Save", "Standard", "Power"]: engine_control.add_item(text)
	engine_control.get_popup().about_to_popup.connect(func(): engine_target_id = selected_id; engine_target_phase = controls.current_phase())
	engine_control.item_selected.connect(func(index):
		if engine_target_id == selected_id and engine_target_phase == controls.current_phase():
			controls.mode(engine_target_id, "engine", index); remember_message()
		refresh())
	engine_control.accessibility_name = "Engine mode for selected driver"; right.add_child(engine_control)
	engine_description = label("", 11, true); right.add_child(engine_description)
	right.add_child(HSeparator.new())
	receipt_label = label("", 12); receipt_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	receipt_label.size.x = 220*text_scale; receipt_label.max_lines_visible = 2
	receipt_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS; right.add_child(receipt_label)
	hint_label = label("", 12, true); hint_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hint_label.size.x = 220*text_scale; hint_label.max_lines_visible = 2
	hint_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS; right.add_child(hint_label)
	var space = Control.new(); space.size_flags_vertical = Control.SIZE_EXPAND_FILL; right.add_child(space)

func select_driver(id: int) -> void:
	if not controls.owned(id): return
	if id != selected_id and engine_control.get_popup().visible: engine_control.get_popup().hide()
	selected_id = id; controls.select_driver(id); refresh()

func remember_message() -> void:
	receipts[selected_id] = controls.message

func driver_action(action: String) -> void:
	match action:
		"send": controls.send_out(selected_id)
		"box": controls.box(selected_id)
		"push": controls.toggle_pace(selected_id, 2)
		"calm": controls.toggle_pace(selected_id, 0)
	remember_message(); refresh()

func advance_stage() -> void:
	if controls.current_phase() == "results": new_weekend_requested.emit(); return
	if controls.advance_stage(): receipts.clear(); global_message = ""
	else: global_message = controls.message
	refresh()

func refresh() -> void:
	if not ready_to_draw or not is_inside_tree(): return
	frame = session.query.capture()
	if frame.is_empty(): return
	var compact = int(get_viewport_rect().size.y <= 760)
	if compact != compact_profile:
		compact_profile = compact
		pit_right.add_theme_constant_override("separation", roundi((2 if compact else 7)*text_scale))
		pit_masthead.visible = not compact; engine_description.visible = not compact
		var pad = roundi((2 if compact else 8)*text_scale)
		pit_selected_panel.add_theme_stylebox_override("panel", MinimalRaceStyle.surface(Color("1e3036"), Color.TRANSPARENT, pad))
		tower.add_theme_constant_override("v_separation", roundi((0 if compact and text_scale >= 1.25 else (1 if compact else 3)) * text_scale))
		timing_stack.add_theme_constant_override("separation", roundi((4 if compact else 8)*text_scale))
		timing_panel.add_theme_stylebox_override("panel", MinimalRaceStyle.surface(MinimalRaceStyle.PANEL, MinimalRaceStyle.LINE, roundi((6 if compact else 12)*text_scale)))
		receipt_label.max_lines_visible = 1 if compact else 2; hint_label.max_lines_visible = 1 if compact else 2
		for card in driver_cards.values(): card.set_compact(compact == 1)
	var active = frame.active
	if engine_control.get_popup().visible and engine_target_phase != frame.phase: engine_control.get_popup().hide()
	playback_label.text = ("Paused" if frame.paused else "Running") if active else "Ready"
	if frame.phase == "results": playback_label.text = "Complete"
	session_label.text = {"briefing":"WEEKEND", "practice_results":"PRACTICE", "qualifying_results":"QUALIFYING", "race_preparation":"RACE", "grid_ready":"GRID"}.get(frame.phase, frame.phase.to_upper())
	var remaining = frame.practice_state.duration - frame.clock if frame.phase == "practice" else frame.qual_duration - frame.clock
	clock_label.text = "%02d:%02d" % [int(maxf(0,remaining))/60, int(maxf(0,remaining))%60] if frame.phase in ["practice","qualifying"] else "Ready"
	if (frame.phase == "practice" and frame.practice_state.closed) or (frame.phase == "qualifying" and frame.qual_closed): clock_label.text = "Session closed"
	if frame.phase == "race": clock_label.text = "Lap %d/%d · %s" % [mini(frame.laps,int(maxf(0,frame.leader_distance)/frame.track.length)+1),frame.laps,frame.flag.capitalize()]
	if frame.phase == "results": clock_label.text = "Final classification"
	elif frame.phase in ["practice_results", "qualifying_results"]: clock_label.text = "Session complete"
	elif frame.phase == "formation": clock_label.text = "Taking the grid"
	elif frame.phase == "lights": clock_label.text = "Race start"
	pause_button.disabled = not active; play_button.disabled = not active
	pause_button.set_pressed_no_signal(active and frame.paused); play_button.set_pressed_no_signal(active and not frame.paused)
	if not speed_control.get_popup().visible: speed_control.select([1,2,4,8,16].find(frame.speed))
	primary_button.text = controls.stage(); primary_button.visible = not primary_button.text.is_empty()
	primary_button.disabled = frame.phase in ["formation","lights"] or (frame.phase == "practice" and frame.practice_state.closed) or (frame.phase == "qualifying" and frame.qual_closed)
	primary_button.tooltip_text = "Close the session; current timed laps may finish. Playback resumes to bring cars home." if frame.phase in ["practice","qualifying"] else "Advance only when you are ready."
	var car = frame.cars[selected_id]
	for id in driver_buttons: driver_buttons[id].set_pressed_no_signal(id == selected_id)
	name_label.text = car.name; state_label.text = car.state; state_label.tooltip_text = state_label.text
	pit_identity.text = "#%02d" % car.number; pit_identity.add_theme_color_override("font_color", Color(car.color))
	engine_description.text = ["Less fuel · less power", "Balanced fuel use", "More fuel · more heat"][car.engine]
	send_button.disabled = not controls.send_reason(selected_id).is_empty()
	send_button.tooltip_text = controls.send_reason(selected_id) if send_button.disabled else "Release " + car.name + ". Practice: two measured laps. Qualifying: one flying lap. Automatic physical return."
	box_button.disabled = not controls.box_reason(selected_id).is_empty()
	box_button.tooltip_text = controls.box_reason(selected_id) if box_button.disabled else ("Return to the garage; the unfinished timed lap is abandoned." if frame.phase != "race" else "Pit at this lap's safe entry. Crew chooses available tyres for the observed conditions.")
	var reason = controls.mode_reason(selected_id)
	push_button.disabled = not reason.is_empty(); calm_button.disabled = not reason.is_empty(); engine_control.disabled = not reason.is_empty()
	push_button.set_pressed_no_signal(car.pace == 2); calm_button.set_pressed_no_signal(car.pace == 0)
	pace_label.text = "Pace · " + ["Calm", "Normal", "Push"][car.pace]
	push_button.tooltip_text = reason if not reason.is_empty() else "More pace, more wear. Press again to return to Normal."
	calm_button.tooltip_text = reason if not reason.is_empty() else "Reduce pace and tyre wear. Press again to return to Normal."
	if not engine_control.get_popup().visible: engine_control.select(car.engine)
	engine_control.tooltip_text = reason if not reason.is_empty() else "Save reduces fuel use; Power spends more fuel and heat. Standard is the normal setting."
	receipt_label.text = global_message if not global_message.is_empty() else receipts.get(selected_id, "")
	receipt_label.visible = not receipt_label.text.is_empty(); receipt_label.tooltip_text = receipt_label.text
	hint_label.text = instruction(); hint_label.tooltip_text = hint_label.text; hint_label.visible = not receipt_label.visible
	present_timing()

func instruction() -> String:
	if frame.cars[selected_id].dnf: return frame.cars[selected_id].retire_reason
	match frame.phase:
		"briefing": return "Start practice, then send out."
		"practice": return "Two measured laps per run."
		"practice_results": return "Start qualifying when ready."
		"qualifying": return "Out lap → flying lap → in lap."
		"qualifying_results", "race_preparation": return "Start formation when ready."
		"formation": return "Cars are forming the grid."
		"grid_ready": return "Start race when ready."
		"lights": return "Watch the lights."
		"race": return "Orders stay active until changed."
		"results": return "Final classification on the left."
	return ""

func build_driver_row() -> void:
	driver_row = HBoxContainer.new(); add_child(driver_row)
	for car in frame.cars:
		if not car.player: continue
		var card = MinimalDriverCard.new(); card.configure(car.id, text_scale)
		driver_row.add_child(card); driver_cards[car.id] = card

func present_timing() -> void:
	var rows = frame.timing_rows
	var timed = frame.phase in MinimalRaceTiming.TIMED
	var grid = frame.phase in MinimalRaceTiming.GRID
	tower.set_column_title(2, "BEST" if timed else ("GRID" if grid else "GAP"))
	timing_caption.text = "Best measured laps" if timed else ("Starting order" if grid else ("Final classification" if frame.phase == "results" else "Gap to leader"))
	tower.set_block_signals(true)
	var previous: TreeItem = null
	var reorder = not Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT)
	if reorder: rank_rows.clear()
	for data in rows:
		var item: TreeItem = items_by_id[data.id]; var selected = data.id == selected_id
		if reorder:
			if previous == null:
				var first = tower.get_root().get_first_child()
				if item != first: item.move_before(first)
			elif previous.get_next() != item: item.move_after(previous)
			previous = item; rank_rows.append(item)
		var key = [data,selected]
		if rendered_rows.get(data.id) != key:
			rendered_rows[data.id] = key; table_updates += 1
			item.set_text(0,str(data.position)); item.set_text(1,data.name); item.set_text(2,data.time); item.set_text(3,data.tag)
			for column in range(4):
				item.set_tooltip_text(column, data.tooltip); item.set_selectable(column, data.player)
				var color = MinimalRaceStyle.ACCENT if data.player else (MinimalRaceStyle.MUTED if column in [0,3] else MinimalRaceStyle.TEXT)
				if column == 3 and data.tag in ["PIT","BOX","RET"]: color = MinimalRaceStyle.WARNING
				item.set_custom_color(column, color)
				item.set_custom_bg_color(column, MinimalRaceStyle.SELECTED if selected else (Color("1d3033") if data.player else MinimalRaceStyle.PANEL))
			if selected and not item.is_selected(0): item.select(0)
		if driver_cards.has(data.id): driver_cards[data.id].present(frame.readouts[data.id],data.position,selected)
	tower.set_block_signals(false)

func _process(delta: float) -> void:
	if session == null or not ready_to_draw: return
	var phase = controls.current_phase()
	if phase != last_phase:
		last_phase = phase; receipts.clear(); global_message = ""; refresh_clock = 0
	if not session_runner.persistence_error.is_empty():
		global_message = "Autosave failed: " + session_runner.persistence_error
	refresh_clock -= delta
	if refresh_clock <= 0: refresh_clock = 0.2; refresh()

func _input(event: InputEvent) -> void:
	if not is_visible_in_tree() or not event is InputEventKey or not event.pressed or event.echo: return
	if engine_control.get_popup().visible or speed_control.get_popup().visible: return
	if event.ctrl_pressed or event.alt_pressed or event.meta_pressed: return
	if event.keycode == KEY_SPACE:
		if controls.is_paused(): controls.play()
		else: controls.pause()
		refresh(); get_viewport().set_input_as_handled()
	elif event.keycode == KEY_F:
		canvas.fit(); get_viewport().set_input_as_handled()
	elif event.keycode >= KEY_1 and event.keycode <= KEY_5:
		controls.set_speed([1,2,4,8,16][event.keycode-KEY_1]); refresh(); get_viewport().set_input_as_handled()

func confirm_leave(callback: Callable) -> void:
	controls.pause(); callback.call()
