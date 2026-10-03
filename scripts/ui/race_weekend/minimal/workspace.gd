class_name MinimalRaceWorkspace
extends VBoxContainer
signal menu_requested
signal new_weekend_requested
signal results_requested
const StrategyComparisonView = preload(
	"res://scripts/ui/race_weekend/minimal/strategy_comparison.gd"
)
## A new, small race screen. Does not construct/inherit Director or Engineering UI.
var session: MinimalRaceHandle
var frame: Dictionary = {}
var session_status: RaceSessionStatus
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
var strategy_button: Button
var strategy_popup: PopupPanel
var strategy_view
var text_scale = 1.0
var preferences: Dictionary = {}
var refresh_clock = 0.0
var last_phase = ""
var table_updates = 0
var receipts: Dictionary = {}
var global_message = ""
var ready_to_draw = false
var compact_profile = -1


func configure(value: MinimalRaceHandle, options: Dictionary = {}) -> void:
	preferences = options.duplicate(true)
	session = value
	controls = value.controls
	session_status = value.status
	frame = value.query.capture()
	selected_id = value.selected_driver()


func _ready() -> void:
	text_scale = float(preferences.get("pitwall_text_scale", 1.0))
	theme = MinimalRaceStyle.theme(text_scale)
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	add_theme_constant_override("separation", 8)
	build_toolbar()
	build_body()
	build_driver_row()
	build_strategy_comparison()
	last_phase = frame.phase
	ready_to_draw = true
	get_viewport().size_changed.connect(func(): call_deferred("refresh"))
	refresh()
	canvas.call_deferred("fit")
	play_button.call_deferred("grab_focus")


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), MinimalRaceStyle.BG)


func label(text: String, points: int = 14, muted: bool = false) -> Label:
	return MinimalRaceStyle.label(text, points, text_scale, muted)


func button(text: String, callback: Callable, toggle: bool = false) -> Button:
	return MinimalRaceStyle.button(text, callback, text_scale, toggle)


func build_toolbar() -> void:
	MinimalRaceWorkspaceBuilder.build_toolbar(self)


func build_body() -> void:
	MinimalRaceWorkspaceBuilder.build_body(self)


func build_pitwall() -> void:
	MinimalRaceWorkspaceBuilder.build_pitwall(self)


func build_strategy_comparison() -> void:
	strategy_popup = PopupPanel.new()
	strategy_popup.exclusive = true
	strategy_popup.unresizable = true
	add_child(strategy_popup)
	var scroll = ScrollContainer.new()
	scroll.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	strategy_popup.add_child(scroll)
	var margin = MarginContainer.new()
	margin.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	margin.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.add_child(margin)
	for side in ["left", "top", "right", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, roundi(14 * text_scale))
	strategy_view = StrategyComparisonView.new()
	strategy_view.configure(text_scale)
	margin.add_child(strategy_view)
	strategy_view.refresh_requested.connect(refresh_strategy_comparison)
	strategy_view.close_requested.connect(close_strategy_comparison)
	strategy_popup.popup_hide.connect(_restore_strategy_focus)
	strategy_popup.window_input.connect(_strategy_window_input)


func show_strategy_comparison() -> void:
	if strategy_button.disabled:
		return
	refresh_strategy_comparison()
	var viewport = get_viewport_rect().size
	var target = Vector2i(
		mini(roundi(720 * text_scale), int(viewport.x - 32)),
		mini(roundi(430 * text_scale), int(viewport.y - 32))
	)
	strategy_popup.min_size = Vector2i.ZERO
	strategy_popup.max_size = target
	strategy_popup.popup_centered(target)
	strategy_view.refresh_button.call_deferred("grab_focus")


func close_strategy_comparison() -> void:
	if strategy_popup.visible:
		strategy_popup.hide()
	_restore_strategy_focus()


func _restore_strategy_focus() -> void:
	if is_inside_tree() and strategy_button != null:
		strategy_button.call_deferred("grab_focus")


func _strategy_window_input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo:
		return
	if event.keycode in [KEY_SPACE, KEY_F, KEY_1, KEY_2, KEY_3, KEY_4, KEY_5]:
		strategy_popup.get_viewport().set_input_as_handled()


func refresh_strategy_comparison() -> void:
	strategy_view.present(
		session.query.strategy_comparison(selected_id), frame.cars[selected_id].name
	)


func select_driver(id: int) -> void:
	if not controls.owned(id):
		return
	if id != selected_id and engine_control.get_popup().visible:
		engine_control.get_popup().hide()
	if id != selected_id and strategy_popup.visible:
		strategy_popup.hide()
	selected_id = id
	controls.select_driver(id)
	refresh()


func remember_message() -> void:
	receipts[selected_id] = controls.message


func driver_action(action: String) -> void:
	match action:
		"send":
			controls.send_out(selected_id)
		"box":
			controls.box(selected_id)
		"push":
			controls.toggle_pace(selected_id, 2)
		"calm":
			controls.toggle_pace(selected_id, 0)
	remember_message()
	refresh()


func advance_stage() -> void:
	if controls.current_phase() == "results":
		results_requested.emit()
		return
	if controls.advance_stage():
		receipts.clear()
		global_message = ""
	else:
		global_message = controls.message
	refresh()


func refresh() -> void:
	if not ready_to_draw or not is_inside_tree():
		return
	frame = session.query.capture()
	if frame.is_empty():
		return
	_adapt_compact_layout()
	var active = frame.active
	if engine_control.get_popup().visible and engine_target_phase != frame.phase:
		engine_control.get_popup().hide()
	playback_label.text = ("Paused" if frame.paused else "Running") if active else "Ready"
	if frame.phase == "results":
		playback_label.text = "Complete"
	session_label.text = (
		{
			"briefing": "WEEKEND",
			"practice_results": "PRACTICE",
			"qualifying_results": "QUALIFYING",
			"race_preparation": "RACE",
			"grid_ready": "GRID"
		}
		. get(frame.phase, frame.phase.to_upper())
	)
	var remaining = (
		frame.practice_state.duration - frame.clock
		if frame.phase == "practice"
		else frame.qual_duration - frame.clock
	)
	clock_label.text = (
		"%02d:%02d" % [int(maxf(0, remaining)) / 60, int(maxf(0, remaining)) % 60]
		if frame.phase in ["practice", "qualifying"]
		else "Ready"
	)
	if (
		(frame.phase == "practice" and frame.practice_state.closed)
		or (frame.phase == "qualifying" and frame.qual_closed)
	):
		clock_label.text = "Session closed"
	if frame.phase == "race":
		clock_label.text = (
			"Lap %d/%d · %s"
			% [
				mini(frame.laps, int(maxf(0, frame.leader_distance) / frame.track.length) + 1),
				frame.laps,
				frame.flag.capitalize()
			]
		)
	if frame.phase == "results":
		clock_label.text = "Final classification"
	elif frame.phase in ["practice_results", "qualifying_results"]:
		clock_label.text = "Session complete"
	elif frame.phase == "formation":
		clock_label.text = "Taking the grid"
	elif frame.phase == "lights":
		clock_label.text = "Race start"
	pause_button.disabled = not active
	play_button.disabled = not active
	pause_button.set_pressed_no_signal(active and frame.paused)
	play_button.set_pressed_no_signal(active and not frame.paused)
	if not speed_control.get_popup().visible:
		speed_control.select([1, 2, 4, 8, 16].find(frame.speed))
	primary_button.text = controls.stage()
	primary_button.visible = not primary_button.text.is_empty()
	primary_button.disabled = (
		frame.phase in ["formation", "lights"]
		or (frame.phase == "practice" and frame.practice_state.closed)
		or (frame.phase == "qualifying" and frame.qual_closed)
	)
	primary_button.tooltip_text = (
		(
			"Close the session; current timed laps may finish. Playback resumes to bring "
			+ "cars home."
		)
		if frame.phase in ["practice", "qualifying"]
		else "Advance only when you are ready."
	)
	_present_selected_driver()
	present_timing()


func instruction() -> String:
	if frame.cars[selected_id].dnf:
		return frame.cars[selected_id].retire_reason
	return (
		{
			"briefing": "Start practice, then send out.",
			"practice": "Two measured laps per run.",
			"practice_results": "Start qualifying when ready.",
			"qualifying": "Out lap → flying lap → in lap.",
			"qualifying_results": "Start formation when ready.",
			"race_preparation": "Start formation when ready.",
			"formation": "Cars are forming the grid.",
			"grid_ready": "Start race when ready.",
			"lights": "Watch the lights.",
			"race": "Orders stay active until changed.",
			"results": "Final classification on the left."
		}
		. get(frame.phase, "")
	)


func build_driver_row() -> void:
	driver_row = HBoxContainer.new()
	add_child(driver_row)
	for car in frame.cars:
		if not car.player:
			continue
		var card = MinimalDriverCard.new()
		card.configure(car.id, text_scale)
		driver_row.add_child(card)
		driver_cards[car.id] = card


func present_timing() -> void:
	MinimalRaceTimingPresenter.present(self)


func _process(delta: float) -> void:
	if session == null or not ready_to_draw:
		return
	var phase = controls.current_phase()
	if phase != last_phase:
		last_phase = phase
		receipts.clear()
		global_message = ""
		refresh_clock = 0
		if strategy_popup.visible:
			strategy_popup.hide()
	if not session_status.persistence_error.is_empty():
		global_message = "Autosave failed: " + session_status.persistence_error
	refresh_clock -= delta
	if refresh_clock <= 0:
		refresh_clock = 0.2
		refresh()


func _input(event: InputEvent) -> void:
	if not is_visible_in_tree() or not event is InputEventKey or not event.pressed or event.echo:
		return
	if (
		engine_control.get_popup().visible
		or speed_control.get_popup().visible
		or strategy_popup.visible
	):
		return
	if event.ctrl_pressed or event.alt_pressed or event.meta_pressed:
		return
	if event.keycode == KEY_SPACE:
		if controls.is_paused():
			controls.play()
		else:
			controls.pause()
		refresh()
		get_viewport().set_input_as_handled()
	elif event.keycode == KEY_F:
		canvas.fit()
		get_viewport().set_input_as_handled()
	elif event.keycode >= KEY_1 and event.keycode <= KEY_5:
		controls.set_speed([1, 2, 4, 8, 16][event.keycode - KEY_1])
		refresh()
		get_viewport().set_input_as_handled()


func confirm_leave(callback: Callable) -> void:
	controls.pause()
	callback.call()


func _adapt_compact_layout() -> void:
	MinimalRaceDriverPresenter._adapt_compact_layout(self)


func _present_selected_driver() -> void:
	MinimalRaceDriverPresenter._present_selected_driver(self)
