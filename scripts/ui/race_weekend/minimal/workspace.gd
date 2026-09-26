class_name MinimalRaceWorkspace
extends VBoxContainer
## A new, small race screen. Does not construct/inherit Director or Engineering UI.
signal menu_requested
signal new_weekend_requested
var sim: PracticeRaceSim
var recording: RaceRecord
var controls = MinimalRaceControls.new()
var toolbar: PanelContainer
var body: HBoxContainer
var timing_panel: PanelContainer
var pitwall: PanelContainer
var canvas: TrackCanvas
var tower: Tree
var rank_rows: Array[TreeItem] = []
var rendered_rows: Dictionary = {}
var driver_buttons: Dictionary = {}
var selected_id = 3
var session_label: Label
var clock_label: Label
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
var refresh_clock = 0.0
var last_phase = ""
var table_updates = 0
var receipts: Dictionary = {}
var global_message = ""
var ready_to_draw = false

func configure(value: PracticeRaceSim) -> void:
	sim = value; controls.configure(value)
	selected_id = value.selected_id if controls.owned(value.selected_id) else 3

func _ready() -> void:
	text_scale = float(App.settings.get("pitwall_text_scale", 1.0))
	theme = MinimalRaceStyle.theme(text_scale)
	size_flags_horizontal = Control.SIZE_EXPAND_FILL; size_flags_vertical = Control.SIZE_EXPAND_FILL
	add_theme_constant_override("separation", 8)
	build_toolbar(); build_body()
	last_phase = sim.phase; ready_to_draw = true
	refresh(); canvas.call_deferred("fit")
	play_button.call_deferred("grab_focus")

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), MinimalRaceStyle.BG)

func label(text: String, points: int = 14, muted: bool = false) -> Label:
	return MinimalRaceStyle.label(text, points, text_scale, muted)

func button(text: String, callback: Callable, toggle: bool = false) -> Button:
	return MinimalRaceStyle.button(text, callback, text_scale, toggle)

func build_toolbar() -> void:
	toolbar = PanelContainer.new(); add_child(toolbar)
	var row = HBoxContainer.new(); toolbar.add_child(row)
	var menu_button = button("Menu", func(): menu_requested.emit()); row.add_child(menu_button)
	menu_button.tooltip_text = "Pause, save this weekend and return to the menu."
	session_label = label("PRACTICE"); row.add_child(session_label)
	clock_label = label("", 14, true); row.add_child(clock_label)
	var spacer = Control.new(); spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL; row.add_child(spacer)
	pause_button = button("Pause", func(): controls.pause(); refresh(), true); row.add_child(pause_button)
	play_button = button("Play", func(): controls.play(); refresh(), true); row.add_child(play_button)
	pause_button.tooltip_text = "Pause simulation · Space"; play_button.tooltip_text = "Run at the selected speed · Space"
	speed_control = OptionButton.new(); speed_control.custom_minimum_size = Vector2(70 * text_scale, 36 * text_scale)
	for speed in [1,2,4,8,16]: speed_control.add_item(str(speed) + "×", speed)
	speed_control.item_selected.connect(func(index): controls.set_speed(speed_control.get_item_id(index)); refresh())
	speed_control.accessibility_name = "Simulation speed"; row.add_child(speed_control)
	primary_button = button("Start practice", advance_stage); row.add_child(primary_button)

func build_body() -> void:
	body = HBoxContainer.new(); body.size_flags_vertical = Control.SIZE_EXPAND_FILL; add_child(body)
	timing_panel = PanelContainer.new(); timing_panel.custom_minimum_size.x = 224 * text_scale; body.add_child(timing_panel)
	var left = VBoxContainer.new(); timing_panel.add_child(left)
	left.add_child(label("TIMING", 12, true))
	tower = Tree.new(); tower.hide_root = true; tower.columns = 3; tower.select_mode = Tree.SELECT_ROW
	tower.column_titles_visible = true; tower.size_flags_vertical = Control.SIZE_EXPAND_FILL
	tower.add_theme_stylebox_override("panel", UI.box(MinimalRaceStyle.PANEL, Color.TRANSPARENT, 0, 0))
	tower.add_theme_stylebox_override("selected", UI.box(MinimalRaceStyle.RAISED, MinimalRaceStyle.ACCENT, 3, 3))
	tower.add_theme_stylebox_override("selected_focus", tower.get_theme_stylebox("selected"))
	tower.add_theme_constant_override("v_separation", roundi(5 * text_scale))
	tower.add_theme_constant_override("indent", 0)
	tower.add_theme_font_size_override("font_size", roundi(13 * text_scale))
	tower.add_theme_font_size_override("title_button_font_size", roundi(11 * text_scale))
	tower.add_theme_color_override("title_button_color", MinimalRaceStyle.MUTED)
	for column in range(3):
		tower.set_column_title(column, ["P", "DRIVER", "TIME"][column])
		tower.set_column_expand(column, column == 2)
		tower.set_column_custom_minimum_width(column, [32, 67, 78][column] * text_scale)
		for state in ["normal", "hover", "pressed"]: tower.add_theme_stylebox_override("title_button_" + state, UI.box(MinimalRaceStyle.PANEL, Color.TRANSPARENT, 0, 2))
	left.add_child(tower); var root_item = tower.create_item()
	for i in range(sim.cars.size()): rank_rows.append(tower.create_item(root_item))
	tower.item_selected.connect(func():
		var item = tower.get_selected()
		if item and controls.owned(int(item.get_metadata(0))): select_driver(int(item.get_metadata(0))))
	tower.accessibility_name = "Timing tower; your drivers are marked with an asterisk"
	left.add_child(label("* Your team   ~ Estimated gap", 10, true))
	canvas = TrackCanvas.new(); canvas.sim = sim; canvas.show_grid = false; canvas.show_line = false; canvas.show_surface = false; canvas.show_labels = App.settings.get("labels", true)
	canvas.fit_padding = Vector2(36,36); canvas.set_track(sim.track); body.add_child(canvas)
	canvas.car_selected.connect(func(id):
		if controls.owned(id): select_driver(id)
		else: sim.selected_id = selected_id)
	canvas.tooltip_text = sim.track.document.name + " · Wheel to zoom; drag with the middle mouse button to pan; F to fit."
	pitwall = PanelContainer.new(); pitwall.custom_minimum_size.x = 244 * text_scale; body.add_child(pitwall)
	var right = VBoxContainer.new(); right.add_theme_constant_override("separation", roundi(4 * text_scale)); pitwall.add_child(right)
	right.add_child(label("PITWALL", 12, true))
	var choices = HBoxContainer.new(); right.add_child(choices)
	for car in sim.cars:
		if not car.player: continue
		var id = int(car.id)
		var choice = button(car.short, func(): select_driver(id), true)
		choice.size_flags_horizontal = Control.SIZE_EXPAND_FILL; choice.tooltip_text = car.name
		choice.accessibility_name = "Select " + car.name; choices.add_child(choice); driver_buttons[id] = choice
	name_label = label(""); right.add_child(name_label)
	state_label = label("", 13, true); right.add_child(state_label)
	right.add_child(HSeparator.new())
	send_button = button("Send out", func(): driver_action("send")); right.add_child(send_button)
	box_button = button("Box this lap", func(): driver_action("box")); right.add_child(box_button)
	pace_label = label("Pace · Normal", 12, true); right.add_child(pace_label)
	var pace_row = HBoxContainer.new(); right.add_child(pace_row)
	push_button = button("Push", func(): driver_action("push"), true); pace_row.add_child(push_button)
	calm_button = button("Calm", func(): driver_action("calm"), true); pace_row.add_child(calm_button)
	for node in [push_button, calm_button]: node.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	right.add_child(label("Engine mode", 12, true))
	engine_control = OptionButton.new(); engine_control.custom_minimum_size.y = 36 * text_scale
	for text in ["Save", "Standard", "Power"]: engine_control.add_item(text)
	engine_control.item_selected.connect(func(index): controls.mode(selected_id,"engine",index); remember_message(); refresh())
	engine_control.accessibility_name = "Engine mode for selected driver"; right.add_child(engine_control)
	right.add_child(HSeparator.new())
	receipt_label = label("", 12); receipt_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; receipt_label.size.x = 220 * text_scale; receipt_label.max_lines_visible = 3; receipt_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS; right.add_child(receipt_label)
	hint_label = label("", 12, true); hint_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; hint_label.size.x = 220 * text_scale; hint_label.max_lines_visible = 3; hint_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS; right.add_child(hint_label)
	var space = Control.new(); space.size_flags_vertical = Control.SIZE_EXPAND_FILL; right.add_child(space)

func select_driver(id: int) -> void:
	if not controls.owned(id): return
	selected_id = id; sim.selected_id = id; refresh()

func remember_message() -> void:
	receipts[selected_id] = controls.message

func driver_action(action: String) -> void:
	match action:
		"send": controls.send_out(selected_id)
		"box": controls.box(selected_id)
		"push": controls.mode(selected_id,"pace",1 if sim.cars[selected_id].pace == 2 else 2)
		"calm": controls.mode(selected_id,"pace",1 if sim.cars[selected_id].pace == 0 else 0)
	remember_message(); refresh()

func advance_stage() -> void:
	if sim.phase == "results": new_weekend_requested.emit(); return
	if controls.advance_stage(): receipts.clear(); global_message = ""
	else: global_message = controls.message
	refresh()

func refresh() -> void:
	if not ready_to_draw: return
	var active = sim.phase in RaceSim.ACTIVE
	session_label.text = {"briefing":"WEEKEND", "practice_results":"PRACTICE", "qualifying_results":"QUALIFYING", "race_preparation":"RACE", "grid_ready":"GRID"}.get(sim.phase, sim.phase.to_upper())
	var remaining = sim.practice_state.duration - sim.clock if sim.phase == "practice" else sim.qual_duration - sim.clock
	clock_label.text = "%02d:%02d" % [int(maxf(0,remaining))/60, int(maxf(0,remaining))%60] if sim.phase in ["practice","qualifying"] else ""
	if sim.phase == "race": clock_label.text = "Lap %d/%d · %s" % [mini(sim.laps,int(maxf(0,sim.standings()[0].distance)/sim.track.length)+1),sim.laps,sim.flag.capitalize()]
	if sim.phase == "results": clock_label.text = "Final classification"
	pause_button.disabled = not active; play_button.disabled = not active
	pause_button.set_pressed_no_signal(active and sim.paused); play_button.set_pressed_no_signal(active and not sim.paused)
	if not speed_control.get_popup().visible: speed_control.select([1,2,4,8,16].find(sim.speed))
	primary_button.text = controls.stage(); primary_button.visible = not primary_button.text.is_empty()
	primary_button.disabled = sim.phase in ["formation","lights"] or (sim.phase == "practice" and sim.practice_state.closed) or (sim.phase == "qualifying" and sim.qual_closed)
	primary_button.tooltip_text = "Close the session; current timed laps may finish. Playback resumes to bring cars home." if sim.phase in ["practice","qualifying"] else "Advance only when you are ready."
	var car = sim.cars[selected_id]
	for id in driver_buttons: driver_buttons[id].set_pressed_no_signal(id == selected_id)
	name_label.text = car.name; state_label.text = MinimalRaceTiming.state(sim,car)
	send_button.disabled = not controls.send_reason(selected_id).is_empty()
	send_button.tooltip_text = controls.send_reason(selected_id) if send_button.disabled else "Release " + car.name + ". Practice: two measured laps. Qualifying: one flying lap. Automatic physical return."
	box_button.disabled = not controls.box_reason(selected_id).is_empty()
	box_button.tooltip_text = controls.box_reason(selected_id) if box_button.disabled else ("Return to the garage; the unfinished timed lap is abandoned." if sim.phase != "race" else "Pit at this lap's safe entry. Crew chooses available tyres for the observed conditions.")
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
	hint_label.text = instruction(); hint_label.tooltip_text = hint_label.text
	present_timing()

func instruction() -> String:
	if sim.cars[selected_id].dnf: return sim.cars[selected_id].retire_reason
	match sim.phase:
		"briefing": return "Start practice, then send each driver out."
		"practice": return "Two measured laps per run. End practice when ready."
		"practice_results": return "Practice complete. Start qualifying when ready."
		"qualifying": return "Out lap → flying lap → in lap. Send each driver when ready."
		"qualifying_results", "race_preparation": return "Grid set. Start formation to take both cars to the grid."
		"formation": return "Cars are forming the grid. No orders needed."
		"grid_ready": return "Everyone is in position. Start race when ready."
		"lights": return "Watch the lights."
		"race": return "Orders stay active until changed. Select a driver before making a call."
		"results": return "The final classification is on the left."
	return ""

func present_timing() -> void:
	var rows = MinimalRaceTiming.rows(sim)
	tower.set_column_title(2,"BEST" if sim.phase in ["practice","practice_results","qualifying","qualifying_results"] else "GAP")
	tower.set_block_signals(true)
	for i in range(rows.size()):
		var data = rows[i]; var item = rank_rows[i]; var selected = data.id == selected_id
		var key = [data,selected]
		if rendered_rows.get(i) != key:
			rendered_rows[i] = key; table_updates += 1
			item.set_metadata(0,data.id); item.set_text(0,str(data.position)); item.set_text(1,data.name); item.set_text(2,data.time)
			for column in range(3):
				item.set_tooltip_text(column,data.tooltip); item.set_selectable(column,controls.owned(data.id))
				item.set_custom_color(column,MinimalRaceStyle.ACCENT if controls.owned(data.id) else MinimalRaceStyle.TEXT)
				item.set_custom_bg_color(column,MinimalRaceStyle.RAISED if selected else MinimalRaceStyle.PANEL)
		if selected: item.select(0)
	tower.set_block_signals(false)

func _process(delta: float) -> void:
	if sim == null or not ready_to_draw: return
	sim.advance(delta)
	if sim.phase != last_phase:
		last_phase = sim.phase; receipts.clear(); global_message = ""; refresh_clock = 0
		if recording != null:
			var error = ReplayStorage.save_session(App.sandbox_path if recording.origin == "sandbox" else App.checkpoint_path,recording)
			if not error.is_empty(): global_message = "Autosave failed: " + error
	refresh_clock -= delta
	if refresh_clock <= 0: refresh_clock = 0.2; refresh()

func _input(event: InputEvent) -> void:
	if not is_visible_in_tree() or not event is InputEventKey or not event.pressed or event.echo: return
	if engine_control.get_popup().visible or speed_control.get_popup().visible: return
	if event.ctrl_pressed or event.alt_pressed or event.meta_pressed: return
	if event.keycode == KEY_SPACE:
		if sim.paused: controls.play()
		else: controls.pause()
		refresh(); get_viewport().set_input_as_handled()
	elif event.keycode == KEY_F:
		canvas.fit(); get_viewport().set_input_as_handled()
	elif event.keycode >= KEY_1 and event.keycode <= KEY_5:
		controls.set_speed([1,2,4,8,16][event.keycode-KEY_1]); refresh(); get_viewport().set_input_as_handled()

func confirm_leave(callback: Callable) -> void:
	controls.pause(); callback.call()
