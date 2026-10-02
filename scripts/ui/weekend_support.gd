class_name WeekendViewSupport
extends VBoxContainer
## Shared Advanced weekend state and interaction/navigation behavior. The concrete
## WeekendView owns composition and live refresh; this base never advances the race.
signal new_weekend_requested
signal menu_requested
var sim: RaceViewQuery
var commands: RaceCommands
var view_session: RaceViewHandle
var presentation_services: RacePresentationServices = RacePresentationServices.new()
var session_status: RaceSessionStatus
var canvas: TrackCanvas
var tower: Tree
var rows: Dictionary = {}
var rank_rows: Array[TreeItem] = []
var rendered_rows: Dictionary = {}
var title_label: Label
var session_label: Label
var flag_label: Label
var weather_label: Label
var clock_label: Label
var primary_button: Button
var pause_button: Button
var driver_label: Label
var telemetry_label: Label
var intent_label: Label
var radio_label: Label
var pace: OptionButton
var engine: OptionButton
var compound: OptionButton
var compound_ids: Array = []
var automate: CheckButton
var repair: CheckButton
var box_button: Button
var cancel_box: Button
var send_button: Button
var recall_button: Button
var setup: SpinBox
var log_label: RichTextLabel
var history_label: RichTextLabel
var trace: RaceMetricChart
var speed_control: OptionButton
var follow_control: CheckButton
var surface_control: CheckButton
var timing_panel: PanelContainer
var right_panel: PanelContainer
var resource_row: HBoxContainer
var compact_resources: Label
var expand_button: Button
var detail_expanded = false
var steps: Array[Label] = []
var teammate_buttons: Array[Button] = []
var resource_labels: Array[Label] = []
var resource_bars: Array[ProgressBar] = []
var pit_note: Label
var command_note: Label
var tabs: TabContainer
var tyre_pages: Array[Control] = []
var tyre_nav: Array[Button] = []
var tyre_topic = 0
var surface_lab: SurfaceLab
var guide: ContextGuide
var detail_picker: OptionButton
var setup_commit: VBoxContainer
var racecraft: RacecraftPanel
var wheel_dashboard: RacecraftPanel.WheelDashboard
var battle_picker: OptionButton
var advisory_button: Button
var radio_filter = "all"
var follow = false
var refresh_time = 0.0
var last_phase = ""
var last_event_count = -1
var last_event_signature = ""
var feedback_until = 0.0
var hint: Label
var tyre_buttons: Array[Button] = []
var tyre_summary: Label
var schedule_lap: SpinBox
var schedule_button: Button
var unschedule_button: Button
var schedule_label: Label
var stint_plot: StintPlot
var navigation: HBoxContainer
var topic_buttons: Dictionary = {}
var watch_button: Button
var detail_caption: Label
var detail_nav_host: VBoxContainer
var pinned_navigation: Dictionary = {}
var detail_actions: VBoxContainer
var map_controls: HBoxContainer
var layers_menu: MenuButton
var layer_controls: Array[CheckButton] = []
var drive_pages: Array[Control] = []
var drive_buttons: Array[Button] = []
var drive_topic = 0
var help_target: Control
var ui_refresh_count = 0
var detail_refresh_count = 0
var decision_strip: PanelContainer
var decision_text: Label
var decision_review: Button
var decision_hold: Button
var session_header: RaceSessionHeader
var timing_view: RaceTimingTower
var race_workspace: RaceObservationWorkspace
var qualifying_workspace: RaceQualifyingWorkspace
var tyre_readout: RaceTyreReadout
var session_strip: PanelContainer
var decision_badge: Label
var decision_signature = ""
var decision_snoozed_signature = ""
var driver_status_card: PanelContainer
var driver_position_label: Label
var driver_rival_label: Label
var driver_plan_label: Label
var telemetry_inspector: RaceTelemetryInspector
var radio_inspector: RaceRadioInspector
var telemetry_chart: RaceMetricChart
var telemetry_sectors: RaceSectorTable
var top_secondary_actions: MenuButton
var race_context_label: Label

class StintPlot extends Control:
	var source: RaceChartQuery
	func _ready(): custom_minimum_size = Vector2(240, 94)
	func _draw():
		draw_style_box(UI.box(UI.CARD), Rect2(Vector2.ZERO, size))
		draw_string(ThemeDB.fallback_font, Vector2(10, 20), "RACE STINTS · fitted sets", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, UI.MUTED)
		if source == null: return
		var car = source.selected_stints()
		if car.is_empty(): return
		var width = size.x - 20
		for stint in car.stints:
			var finish = stint.to if stint.to >= 0 else maxf(stint.from, car.distance / car.length)
			var left = clampf(stint.from / car.laps, 0, 1) * width + 10
			var right = clampf(finish / car.laps, 0, 1) * width + 10
			var item = stint
			var color = Color(item.get("color", "9cae94"))
			draw_rect(Rect2(left, 33, maxf(2, right - left - 1), 20), color)
			if right - left > 24: draw_string(ThemeDB.fallback_font, Vector2(left + 3, 48), item.get("label", ""), HORIZONTAL_ALIGNMENT_LEFT, -1, 10, GameTheme.ink_on(color))
		if car.scheduled_lap > 0:
			var x = 10 + clampf(car.pit_gate / car.length / car.laps, 0, 1) * width
			draw_line(Vector2(x, 28), Vector2(x, 59), UI.ACCENT, 2, true)
		draw_string(ThemeDB.fallback_font, Vector2(10, 77), "START                         LAP %d" % car.laps, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, UI.MUTED)


func configure(value: RaceViewHandle) -> void:
	view_session = value
	session_status = value.status
	commands = value.commands
	sim = value.query

func setup_guide() -> void:
	guide = ContextGuide.new(); guide.presentation_services = presentation_services
	guide.configure("pit wall", [
		{"title": "Your two drivers", "body": "MER and MOR are your cars. Select either teammate or click a dot. Rivals can be inspected but cannot receive your commands. Reading this guide does not pause a live session.", "target": func(): return teammate_buttons[0].get_parent()},
		{"title": "A clear next action", "body": "Qualifying, preparation, formation, lights and racing are separate phases. Approve the highlighted session action when ready. Space pauses; 1–5 changes speed.", "target": func(): return primary_button},
		{"title": "Set up the car", "body": "Open Setup & handling. Stage five adjustments and Apply once. Mechanical changes need the garage; front brake bias remains adjustable while racing. Unapplied values do nothing.", "target": func(): return tabs, "reveal": func(): open_topic(4)},
		{"title": "Plan a real tyre set", "body": "The Tyres page separates four contact patches from the finite allocation. Used sets retain damage. Choosing a set plans it; Send, formation or actual servicing fits it. Schedule one future stop or Box now.", "target": func(): return tabs, "reveal": func(): open_topic(3)},
		{"title": "Understand the lap", "body": "Telemetry keeps measured splits and valid or invalid laps. Flags, tyre damage and pit decisions can be filtered in Radio. Warning chips open tyre detail without taking control of the car.", "target": func(): return tabs, "reveal": func(): open_topic(1)},
		{"title": "Read the changing road", "body": "Track surface lab exposes seven strips across the road: water, rubber, grip and contamination. Click or arrow through cells, then Locate. This is live data, not an illustrated racing-line mask.", "target": func(): return tabs, "reveal": func(): open_topic(5)},
		{"title": "Watch or take control", "body": "Delegate routine runs and strategy to the engineer, or change pace, engine, racecraft and pit calls yourself. The Box and Send controls stay visible while you inspect other topics.", "target": func(): return tabs, "reveal": func(): open_topic(0)}
	])
	add_child(guide)

func tab_page(title: String) -> VBoxContainer:
	var scroll=RaceInspectorPage.new();scroll.name=title;tabs.add_child(scroll)
	return scroll.body

func fit_canvas() -> void: canvas.fit()

func set_follow(value: bool) -> void:
	follow = value
	if value and canvas: canvas.fit_view_enabled = false
	if follow_control: follow_control.set_pressed_no_signal(value)

func select_driver(id: int) -> void:
	if id < 0 or id >= sim.car_count: return
	commands.select_driver(id); refresh()

func feedback(text: String) -> void:
	radio_label.text = text; feedback_until = Time.get_ticks_msec() / 1000.0 + 5

func dispatch(action: String, payload: Dictionary = {}) -> void:
	payload.id = sim.selected_id
	if not commands.execute(action, payload): feedback(sim.last_error)
	elif action not in ["pause", "speed"]: feedback("%s · %s acknowledged" % [sim.car(sim.selected_id).short, action.replace("_", " ")])
	refresh()

func primary_action() -> void:
	match sim.phase:
		"briefing": dispatch("qualify")
		"qualifying":
			var confirm = ConfirmationDialog.new(); confirm.title = "Close qualifying?"; confirm.dialog_text = "No new flying laps may start. Existing hot laps can finish; all cars then return to the garage."
			add_child(confirm); confirm.confirmed.connect(func(): confirm.queue_free(); dispatch("close_qualifying")); confirm.canceled.connect(confirm.queue_free); confirm.popup_centered(Vector2i(490, 170))
		"qualifying_results": dispatch("prepare_race")
		"race_preparation": dispatch("formation")
		"grid_ready": dispatch("lights")
		"results": new_weekend_requested.emit()

func refresh() -> void:
	pass

func current_decision(c: Dictionary) -> Dictionary:
	if sim.phase != "race" or not c.player or c.dnf or c.finished or c.route == "pit": return {"signature": "", "text": "", "badge": "CLEAR", "color": UI.GOOD, "topic": 0}
	if c.health < 55:
		return {"signature": "%s:health:%d" % [c.id, int(c.health / 10)], "text": "%s · Car condition %d%% · review recovery or pit service" % [c.short, c.health], "badge": "CAR", "color": UI.DANGER, "topic": 0}
	if c.tyre < 28:
		return {"signature": "%s:tyre:%d" % [c.id, int(c.tyre / 5)], "text": "%s · Tyre life %d%% · current set is becoming the limiting factor" % [c.short, c.tyre], "badge": "TYRE", "color": UI.ACCENT, "topic": 3}
	if sim.race_forecaster_fuel_margin(c) < 0.35:
		return {"signature": "%s:fuel:%d" % [c.id, int(floor(sim.race_forecaster_fuel_margin(c) * 4))], "text": "%s · Estimated finish fuel %+.1f laps · review engine policy" % [c.short, sim.race_forecaster_fuel_margin(c)], "badge": "FUEL", "color": UI.ACCENT, "topic": 0}
	if c.scheduled_lap > 0 and c.scheduled_lap <= int(maxf(0, c.distance) / sim.track.length) + 2:
		return {"signature": "%s:pit:%d" % [c.id, c.scheduled_lap], "text": "%s · Pit plan active for lap %d · review stop plan before commitment" % [c.short, c.scheduled_lap], "badge": "PIT", "color": UI.ACCENT, "topic": 3}
	return {"signature": "", "text": "", "badge": "CLEAR", "color": UI.GOOD, "topic": 0}

func review_decision() -> void:
	var issue = current_decision(sim.car(sim.selected_id))
	if issue.signature.is_empty(): return
	open_topic(issue.topic)

func hold_decision() -> void:
	if decision_signature.is_empty(): return
	decision_snoozed_signature = decision_signature
	feedback("Plan retained · this prompt returns only after the underlying condition changes")
	refresh()

func weekend_action(id: int) -> void:
	match id:
		0: save_checkpoint()
		1: export_log()
		2: guide.open_guide()
		3: menu_requested.emit()

func save_checkpoint() -> void:
	var error = presentation_services.save_live()
	feedback("Weekend saved. Continue resumes this checkpoint." if error.is_empty() else error)

func export_log() -> void:
	var dialog = UI.file_dialog(self, true, ["*.json ; Weekend analysis log"], func(path):
		var data = {"kind": "motorsport-manager-race-log", "version": 2, "track": sim.track.document.name, "seed": sim.seed_value, "events": sim.events, "commands": sim.commands, "classification": sim.standings(), "phase": sim.phase, "stats": sim.stats}
		var error = presentation_services.export_value(path, data); feedback("Race log exported." if error.is_empty() else error))
	dialog.current_file = "weekend-log.json"

func _unhandled_key_input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo: return
	var focus = get_viewport().gui_get_focus_owner()
	if event.keycode == KEY_F1 and is_instance_valid(help_target) and not help_target.tooltip_text.is_empty():
		UI.notify(self, "Control help", help_target.tooltip_text); get_viewport().set_input_as_handled(); return
	if focus is LineEdit or focus is TextEdit: return
	if event.keycode == KEY_ESCAPE and right_panel.visible: close_detail(); get_viewport().set_input_as_handled()
	elif event.keycode == KEY_SPACE and sim.phase in RaceViewQuery.ACTIVE: dispatch("pause"); get_viewport().set_input_as_handled()
	elif event.keycode == KEY_B and not box_button.disabled: dispatch("pit"); get_viewport().set_input_as_handled()
	elif event.keycode == KEY_TAB and event.ctrl_pressed: select_driver(sim.teammate_id(sim.selected_id)); get_viewport().set_input_as_handled()
	elif event.keycode == KEY_F: set_follow(false); canvas.fit(); get_viewport().set_input_as_handled()
	elif event.keycode >= KEY_1 and event.keycode <= KEY_5: dispatch("speed", {"value": [1, 2, 4, 8, 16][event.keycode - KEY_1]}); get_viewport().set_input_as_handled()

func show_tyres(index: int) -> void:
	open_detail()
	tyre_topic = clampi(index, 0, 2); tabs.current_tab = 3
	for i in range(tyre_pages.size()):
		tyre_pages[i].visible = i == tyre_topic
		UI.set_active(tyre_nav[i], i == tyre_topic)
	tabs.get_tab_control(3).scroll_vertical = 0

func refresh_tyres(c: Dictionary, controllable: bool) -> void:
	if tyre_readout:tyre_readout.present()
	if tyre_buttons.is_empty(): return
	var planned = sim.planned_set(c, sim.phase == "race")
	for i in range(12):
		var item = c.tyre_sets[i]; var button = tyre_buttons[i]
		var mounted = item.id == c.set_id
		var selected = not planned.is_empty() and item.id == planned.id
		var state = "FITTED" if mounted else ("PLANNED" if selected else ("USED" if item.used else "FRESH"))
		button.text = "%s  %d%%\n%s" % [item.label, item.life, state]
		button.disabled = not controllable or c.route == "pit" or not WheelTyres.usable(item) or sim.phase == "race" and mounted
		UI.set_active(button, selected)
		button.tooltip_text = "%s · %d°C · %.2f laps · %d mounts\nCondition and temperature persist when removed." % [item.id, item.temperature, item.laps, item.mounts]
	tyre_summary.text = sim.strategy_advice(c)
	schedule_button.disabled = not controllable or sim.phase != "race" or c.route != "track" or c.pit_order or sim.laps <= 1
	unschedule_button.disabled = not controllable or c.route != "track" or c.scheduled_lap < 1
	schedule_label.text = ("Booked for lap %d. Box cancels this plan and calls the next safe entry." % c.scheduled_lap) if c.scheduled_lap > 0 else "No stop scheduled. Lap numbers refer to the entry gate on that racing lap, not crossing the finish line."
	stint_plot.queue_redraw()

func set_detail_expanded(value: bool) -> void:
	detail_expanded = value
	timing_panel.visible = not value
	right_panel.custom_minimum_size.x = 520 if value else 360
	driver_status_card.visible = not value; resource_row.visible = not value
	compact_resources.visible = value; expand_button.text = "Narrow" if value else "Widen"
	open_detail()
	# A layout change is presentation only. Preserve the camera's world-space center.
	refresh()


func register_topic(title: String, index: int, position: int = -1) -> void:
	var button = UI.button(title, func(): open_topic(index))
	button.tooltip_text = {0: "Driver modes, release and recall.", 1: "Measured timing and speed trace.", 2: "Recoverable race messages and flags.", 3: "Finite tyre allocation, wheel condition and stop scheduling.", 4: "Stage garage setup; apply explicitly.", 5: "Advanced inspection of the authoritative track surface.", 6: "Compare options, draft a plan or change control ownership.", 7: "Review measured decisions and outcomes.", 8: "Cooperate, watch battles or coordinate the shared pit box."}.get(index, title)
	button.add_theme_font_size_override("font_size", 12)
	navigation.add_child(button); topic_buttons[index] = button
	if position >= 0: navigation.move_child(button, position)

func pin_navigation(index: int, control: Control) -> void:
	control.reparent(detail_nav_host); pinned_navigation[index] = control
	control.visible = tabs.current_tab == index

func refresh_navigation() -> void:
	if not navigation or not tabs: return
	UI.set_active(watch_button, not right_panel.visible)
	for index in topic_buttons: UI.set_active(topic_buttons[index], right_panel.visible and tabs.current_tab == index)
	for index in pinned_navigation: pinned_navigation[index].visible = tabs.current_tab == index
	if detail_caption: detail_caption.text = detail_picker.get_item_text(tabs.current_tab)

func open_topic(index: int) -> void:
	open_detail()
	if trace: trace.visible = index == 1
	if tabs.current_tab != index: tabs.current_tab = index
	else: refresh_navigation(); refresh()

func open_detail() -> void:
	if right_panel: right_panel.visible = true
	refresh_navigation()

func close_detail() -> void:
	if not right_panel: return
	detail_expanded = false; timing_panel.visible = true; right_panel.visible = false
	right_panel.custom_minimum_size.x = 360; expand_button.text = "Widen"
	trace.visible = false; driver_status_card.visible = true; resource_row.visible = true; compact_resources.visible = false
	refresh_navigation()
	watch_button.grab_focus()

func wire_control_help(node: Node) -> void:
	if node is SpinBox: wire_control_help(node.get_line_edit())
	# Bind once, not on telemetry refresh. Focus exposes the same explanation as hover.
	if node is Control and (node is BaseButton or node is LineEdit) and not node.has_meta("help_bound"):
		node.set_meta("help_bound", true)
		if node is LineEdit and node.get_parent() is SpinBox and node.tooltip_text.is_empty(): node.tooltip_text = node.get_parent().tooltip_text
		node.mouse_entered.connect(func(): help_target = node)
		node.focus_entered.connect(func(): help_target = node)
		node.mouse_exited.connect(func():
			if help_target == node and not node.has_focus(): help_target = null)
		node.focus_exited.connect(func():
			if help_target == node: help_target = null)
	for child in node.get_children(): wire_control_help(child)

func add_layer(title: String, value: bool, callback: Callable) -> CheckButton:
	var control = UI.check(title, value, callback)
	# Keep one source of state for the menu and surface inspector without duplicate visible controls.
	map_controls.add_child(control); control.visible = false
	layers_menu.get_popup().add_check_item(title, layer_controls.size())
	layer_controls.append(control)
	return control

func show_drive(index: int) -> void:
	drive_topic = index
	for i in range(drive_pages.size()):
		drive_pages[i].visible = i == index; UI.set_active(drive_buttons[i], i == index)

func _input(event: InputEvent) -> void:
	# Space pauses instead of activating a focused Box; F1 also works inside text fields.
	if not event is InputEventKey or not event.pressed or event.echo: return
	for window in get_viewport().get_embedded_subwindows():
		if window.visible: return
	var focus = get_viewport().gui_get_focus_owner()
	if event.keycode == KEY_F1:
		var target = focus if focus is Control and not focus.tooltip_text.is_empty() else help_target
		if is_instance_valid(target) and not target.tooltip_text.is_empty():
			UI.notify(self, "Control help", target.tooltip_text); get_viewport().set_input_as_handled()
		return
	if event.keycode != KEY_SPACE or sim == null or sim.phase not in RaceViewQuery.ACTIVE: return
	if focus is LineEdit or focus is TextEdit: return
	dispatch("pause"); get_viewport().set_input_as_handled()

func _inspect_qualifying(id: int) -> void:
	select_driver(id); open_topic(0)

func _set_radio_filter(index: int) -> void:
	radio_filter=["all","flags","pit","tyre","weather"][index];last_event_count=-1;refresh()
