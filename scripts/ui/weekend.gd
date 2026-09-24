class_name WeekendView
extends VBoxContainer
## Persistent native controls: live telemetry never rebuilds the timing tree or pit wall.
signal new_weekend_requested
signal menu_requested
var sim: RaceSim
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
var automate: CheckButton
var repair: CheckButton
var box_button: Button
var cancel_box: Button
var send_button: Button
var recall_button: Button
var setup: SpinBox
var log_label: RichTextLabel
var history_label: RichTextLabel
var trace: TelemetryPlot
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

class StintPlot extends Control:
	var sim: RaceSim
	func _ready(): custom_minimum_size = Vector2(240, 94)
	func _draw():
		draw_style_box(UI.box(UI.CARD), Rect2(Vector2.ZERO, size))
		draw_string(ThemeDB.fallback_font, Vector2(10, 20), "RACE STINTS · fitted sets", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, UI.MUTED)
		if sim == null: return
		var car = sim.cars[sim.selected_id]
		var width = size.x - 20
		for stint in car.stints:
			var finish = stint.to if stint.to >= 0 else maxf(stint.from, car.distance / sim.track.length)
			var left = clampf(stint.from / sim.laps, 0, 1) * width + 10
			var right = clampf(finish / sim.laps, 0, 1) * width + 10
			var item = TyreInventory.find(car, stint.set_id)
			var color = {"S": Color("c9927d"), "M": Color("c4ad70"), "H": Color("9cae94"), "I": Color("7e9b7b"), "W": Color("83a6b5")}.get(item.get("compound", "M"), UI.GOOD)
			draw_rect(Rect2(left, 33, maxf(2, right - left - 1), 20), color)
			if right - left > 24: draw_string(ThemeDB.fallback_font, Vector2(left + 3, 48), item.get("label", ""), HORIZONTAL_ALIGNMENT_LEFT, -1, 10, UI.INK)
		if car.scheduled_lap > 0:
			var x = 10 + clampf(car.pit_gate / sim.track.length / sim.laps, 0, 1) * width
			draw_line(Vector2(x, 28), Vector2(x, 59), UI.ACCENT, 2, true)
		draw_string(ThemeDB.fallback_font, Vector2(10, 77), "START                         LAP %d" % sim.laps, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, UI.MUTED)


class TelemetryPlot extends Control:
	var sim: RaceSim
	func _ready(): custom_minimum_size.y = 104
	func _draw():
		draw_style_box(UI.box(UI.PANEL), Rect2(Vector2.ZERO, size))
		draw_string(ThemeDB.fallback_font, Vector2(14, 20), "TELEMETRY   /   SPEED · km/h                                      LAST 120 s", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, UI.MUTED)
		for i in range(1, 4):
			var y = 29 + i * (size.y - 40) / 4
			draw_line(Vector2(14, y), Vector2(size.x - 14, y), UI.LINE, 1)
		if sim == null: return
		var c = sim.cars[sim.selected_id]; var samples: Array = c.telemetry
		if samples.size() < 2:
			draw_string(ThemeDB.fallback_font, Vector2(14, 63), "Live speed trace appears after the car leaves its garage.", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, UI.MUTED)
			return
		var line = PackedVector2Array()
		for i in range(samples.size()):
			line.append(Vector2(14 + (size.x - 28) * i / maxf(1, samples.size() - 1), size.y - 12 - clampf(samples[i][1] / 340.0, 0, 1) * (size.y - 43)))
		draw_polyline(line, Color(c.color).darkened(0.25), 1.8, true)

func configure(value: RaceSim) -> void:
	sim = value

func _ready() -> void:
	size_flags_vertical = Control.SIZE_EXPAND_FILL; size_flags_horizontal = Control.SIZE_EXPAND_FILL
	add_theme_constant_override("separation", 5)
	var heading = UI.hbox(self)
	var titles = UI.hbox(heading); titles.alignment = BoxContainer.ALIGNMENT_BEGIN
	title_label = UI.label(sim.track.document.name, 22); titles.add_child(title_label)
	session_label = UI.label("", 12, UI.MUTED); titles.add_child(session_label); session_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS; session_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL; titles.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var spacer = Control.new(); spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL; heading.add_child(spacer)
	primary_button = UI.button("Start qualifying", primary_action, true); primary_button.custom_minimum_size.x = 174; heading.add_child(primary_button)
	var progress = UI.hbox(self)
	for text in ["01 Qualifying", "02 Preparation", "03 Formation", "04 Start", "05 Race", "06 Results"]:
		var step = UI.label(text, 11, UI.MUTED); step.size_flags_horizontal = Control.SIZE_EXPAND_FILL; progress.add_child(step); steps.append(step)
	var strip = HBoxContainer.new(); add_child(strip)
	pause_button = UI.button("Pause", func(): dispatch("pause")); strip.add_child(pause_button)
	speed_control = UI.option(["1×", "2×", "4×", "8×", "16×"], func(index): dispatch("speed", {"value": [1, 2, 4, 8, 16][index]})); strip.add_child(speed_control)
	clock_label = UI.label("", 14); clock_label.custom_minimum_size.x = 144; strip.add_child(clock_label)
	flag_label = UI.label("GREEN", 12, UI.GOOD); flag_label.custom_minimum_size.x = 84; strip.add_child(flag_label)
	weather_label = UI.label("", 12, UI.MUTED); weather_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL; weather_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS; strip.add_child(weather_label)
	strip.add_child(UI.button("Save", save_checkpoint)); strip.add_child(UI.button("Export log", export_log))
	strip.add_child(UI.button("Guide", func(): guide.open_guide()))
	strip.add_child(UI.button("Menu", func(): menu_requested.emit()))
	navigation = UI.hbox(self); navigation.add_theme_constant_override("separation", 3)
	watch_button = UI.button("Watch", close_detail); watch_button.tooltip_text = "Close the inspector and give the circuit more space. No orders or time changes."; navigation.add_child(watch_button)
	var body = UI.hbox(self, true)
	timing_panel = UI.panel(); timing_panel.custom_minimum_size.x = 232; body.add_child(timing_panel)
	var timing = UI.vbox(timing_panel, true)
	timing.add_child(UI.label("LIVE CLASSIFICATION", 12, UI.ACCENT))
	tower = Tree.new(); tower.select_mode = Tree.SELECT_ROW; tower.columns = 5; tower.hide_root = true; tower.hide_folding = true
	tower.column_titles_visible = true; tower.size_flags_vertical = Control.SIZE_EXPAND_FILL
	tower.add_theme_font_size_override("font_size", 12); tower.add_theme_font_size_override("title_button_font_size", 10)
	tower.add_theme_constant_override("v_separation", 4); tower.add_theme_constant_override("indent", 0)
	tower.add_theme_stylebox_override("panel", UI.box(UI.PANEL, UI.LINE, 4, 2))
	for i in range(5):
		tower.set_column_title(i, ["P", "CAR", "GAP / LAP", "TYRE", "STATE"][i]); tower.set_column_expand(i, false)
		tower.set_column_custom_minimum_width(i, [26, 42, 67, 28, 37][i])
	tower.item_selected.connect(func():
		var item = tower.get_selected()
		if item: select_driver(int(item.get_metadata(0))))
	timing.add_child(tower)
	var root_item = tower.create_item()
	for i in range(12): rank_rows.append(tower.create_item(root_item))
	var legend = UI.label("MER / MOR · Your cars   |   ~ Estimate", 11, UI.MUTED); legend.tooltip_text = "Qualifying: OUT → HOT → IN → BOX. Only timed hot laps set the grid."; timing.add_child(legend)
	var visual = UI.vbox(body, true)
	var view_row = HBoxContainer.new(); map_controls = view_row; visual.add_child(view_row)
	view_row.add_child(UI.button("Fit · F", func(): set_follow(false); canvas.fit()))
	follow_control = UI.check("Follow", false, set_follow); view_row.add_child(follow_control)
	layers_menu = MenuButton.new(); layers_menu.text = "Layers"; layers_menu.flat = false; layers_menu.custom_minimum_size.y = 32
	layers_menu.tooltip_text = "Optional racing line, driver labels and surface overlays. These never change race conditions."
	view_row.add_child(layers_menu)
	add_layer("Racing line", App.settings.racing_line, func(value): canvas.show_line = value; canvas.queue_redraw())
	add_layer("Driver labels", App.settings.labels, func(value): canvas.show_labels = value; canvas.queue_redraw())
	surface_control = add_layer("Track surface", false, func(value): canvas.show_surface = value; canvas.queue_redraw())
	layers_menu.get_popup().hide_on_checkable_item_selection = false
	layers_menu.get_popup().id_pressed.connect(func(id):
		var control = layer_controls[id]; control.button_pressed = not control.button_pressed
		layers_menu.get_popup().set_item_checked(id, control.button_pressed))
	layers_menu.get_popup().about_to_popup.connect(func():
		for i in range(layer_controls.size()): layers_menu.get_popup().set_item_checked(i, layer_controls[i].button_pressed))
	canvas = TrackCanvas.new(); canvas.sim = sim; canvas.show_line = App.settings.racing_line; canvas.show_labels = App.settings.labels; canvas.show_grid = false
	canvas.set_track(sim.track); visual.add_child(canvas); canvas.car_selected.connect(select_driver)
	canvas.navigated.connect(func(): set_follow(false))
	trace = TelemetryPlot.new(); trace.sim = sim; visual.add_child(trace)
	right_panel = UI.panel(); right_panel.custom_minimum_size.x = 360; body.add_child(right_panel)
	var wall = UI.vbox(right_panel, true); wall.add_theme_constant_override("separation", 5)
	
	var teammates = UI.hbox(wall)
	for id in [3, 6]:
		var b = UI.button("", func(): select_driver(id)); b.size_flags_horizontal = Control.SIZE_EXPAND_FILL; b.add_theme_font_size_override("font_size", 12)
		teammates.add_child(b); teammate_buttons.append(b)
	driver_label = UI.label("", 13, UI.ACCENT); wall.add_child(driver_label)
	intent_label = UI.label("", 12, UI.MUTED); intent_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS; wall.add_child(intent_label)
	resource_row = UI.hbox(wall)
	for title in ["TYRES", "FUEL", "INTEGRITY"]:
		var cell = UI.vbox(resource_row); cell.size_flags_horizontal = Control.SIZE_EXPAND_FILL; cell.add_theme_constant_override("separation", 3)
		cell.add_child(UI.label(title, 10, UI.MUTED))
		var value = UI.label("", 14); cell.add_child(value); resource_labels.append(value)
		var bar = ProgressBar.new(); bar.show_percentage = false; bar.custom_minimum_size = Vector2(55, 4)
		bar.add_theme_stylebox_override("background", UI.box(UI.LINE, UI.LINE, 2, 0)); bar.add_theme_stylebox_override("fill", UI.box(UI.GOOD, UI.GOOD, 2, 0))
		cell.add_child(bar); resource_bars.append(bar)
	compact_resources = UI.label("", 12, UI.MUTED); compact_resources.visible = false; wall.add_child(compact_resources)
	advisory_button = UI.button("No team advisories", func(): show_tyres(1))
	advisory_button.add_theme_font_size_override("font_size", 11); advisory_button.custom_minimum_size.y = 28; advisory_button.visible = false; wall.add_child(advisory_button)
	detail_picker = UI.option(["Commands", "Telemetry & lap history", "Race control & radio", "Tyres & strategy", "Setup & handling", "Track surface lab"], func(index): tabs.current_tab = index)
	detail_picker.tooltip_text = "Inspect one topic at a time. Primary pit actions remain below."
	var topic_row = UI.hbox(wall); detail_picker.visible = false; topic_row.add_child(detail_picker)
	detail_caption = UI.label("Drive", 13, UI.ACCENT); detail_caption.size_flags_horizontal = Control.SIZE_EXPAND_FILL; topic_row.add_child(detail_caption)
	expand_button = UI.button("Expand", func(): set_detail_expanded(not detail_expanded)); expand_button.add_theme_font_size_override("font_size", 12)
	expand_button.tooltip_text = "Give this topic more space. The timing tower is temporarily hidden; the map and pit actions stay available."; topic_row.add_child(expand_button)
	var close_button = UI.button("Close", close_detail); close_button.tooltip_text = "Return to watching. Drafts remain unapplied and are retained."; topic_row.add_child(close_button)
	detail_nav_host = UI.vbox(wall)
	tabs = TabContainer.new(); tabs.tabs_visible = false; tabs.size_flags_vertical = Control.SIZE_EXPAND_FILL; wall.add_child(tabs)
	tabs.tab_changed.connect(func(index):
		detail_picker.select(index)
		if setup_commit: setup_commit.visible = index == 4
		open_detail()
		refresh_navigation()
		if radio_label: refresh())
	var command_page = tab_page("Commands")
	var drive_sections = UI.hbox(command_page)
	for i in range(2):
		var button = UI.button(["Driving", "Pit service"][i], func(): show_drive(i)); button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		drive_sections.add_child(button); drive_buttons.append(button)
	for i in range(2): drive_pages.append(UI.vbox(command_page))
	drive_pages[1].visible = false
	var commands = drive_pages[0]
	automate = UI.check("Delegate to engineer", true, func(value): dispatch("auto", {"value": value})); commands.add_child(automate)
	pace = UI.option(["Conserve pace", "Balanced pace", "Push pace"], func(index): dispatch("pace", {"value": index})); commands.add_child(pace)
	engine = UI.option(["Economy engine", "Standard engine", "Overtake engine"], func(index): dispatch("engine", {"value": index})); commands.add_child(engine)
	battle_picker = UI.option(["Patient racecraft", "Balanced racecraft", "Assertive racecraft"], func(index): dispatch("battle_mode", {"value": ["patient", "balanced", "assertive"][index]}), 1)
	battle_picker.tooltip_text = "Changes passing choices and incident exposure, not engine power."; commands.add_child(battle_picker)
	commands = drive_pages[1]
	commands.add_child(UI.label("COMPOUND / NEXT STOP", 11, UI.MUTED))
	compound = UI.option(["S · Soft", "M · Medium", "H · Hard", "I · Intermediate", "W · Wet"], func(index): dispatch("compound", {"value": ["S", "M", "H", "I", "W"][index]})); commands.add_child(compound)
	commands.add_child(UI.button("Choose a fresh or used set →", func(): show_tyres(0)))
	repair = UI.check("Repair damage at stop", true, func(value): dispatch("repair", {"value": value})); commands.add_child(repair)
	setup = UI.spin(5, 1, 9, 1, func(value): dispatch("setup", {"value": value})); UI.field(commands, "Wing level", setup)
	commands.add_child(UI.button("Open complete setup →", func(): tabs.current_tab = 4))
	command_note = UI.paragraph("", UI.MUTED); command_note.add_theme_font_size_override("font_size", 12); drive_pages[0].add_child(command_note)
	var telemetry = tab_page("Telemetry")
	telemetry_label = UI.label("", 14); telemetry.add_child(telemetry_label)
	history_label = RichTextLabel.new(); history_label.custom_minimum_size = Vector2(245, 215); history_label.add_theme_font_size_override("normal_font_size", 12); telemetry.add_child(history_label)
	var radio = tab_page("Radio")
	radio.add_child(UI.paragraph("Latest first. Reading radio does not pause a live session; use Space to pause."))
	radio.add_child(UI.option(["All events", "Flags & incidents", "Pit decisions", "Tyre condition", "Weather"], func(index):
		radio_filter = ["all", "flags", "pit", "tyre", "weather"][index]; last_event_count = -1; refresh()))
	log_label = RichTextLabel.new(); log_label.custom_minimum_size = Vector2(245, 300); log_label.selection_enabled = true; log_label.add_theme_font_size_override("normal_font_size", 12); radio.add_child(log_label)
	var tyres = tab_page("Tyres")
	var tyre_sections = UI.hbox(tyres)
	for index in range(3):
		var b = UI.button(["Allocation", "Wheels", "Stop plan"][index], func(): show_tyres(index))
		b.add_theme_font_size_override("font_size", 12); b.custom_minimum_size.y = 32; b.size_flags_horizontal = Control.SIZE_EXPAND_FILL; tyre_sections.add_child(b); tyre_nav.append(b)
	var stock = UI.vbox(tyres); tyre_pages.append(stock)
	stock.add_child(UI.label("PLAN A SET · THEN BOX / SEND", 12, UI.ACCENT))
	var sets = GridContainer.new(); sets.columns = 3; stock.add_child(sets)
	for index in range(12):
		var button = UI.button("", func(): dispatch("select_set", {"set_id": sim.cars[sim.selected_id].tyre_sets[index].id}))
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL; button.custom_minimum_size = Vector2(74, 47); button.add_theme_font_size_override("font_size", 10)
		sets.add_child(button); tyre_buttons.append(button)
	stock.add_child(UI.paragraph("Planned is not fitted. Used sets keep their four-wheel damage; no new stock is created."))
	var condition = UI.vbox(tyres); tyre_pages.append(condition); condition.visible = false
	wheel_dashboard = RacecraftPanel.WheelDashboard.new(); wheel_dashboard.model = sim; condition.add_child(wheel_dashboard)
	var planning = UI.vbox(tyres); tyre_pages.append(planning); planning.visible = false
	planning.add_child(UI.label("PLANNED PIT STOP", 12, UI.ACCENT))
	var plan_row = UI.hbox(planning)
	plan_row.add_child(UI.label("Racing lap", 12, UI.MUTED))
	schedule_lap = UI.spin(2, 1, maxi(1, sim.laps - 1), 1, func(_value): pass)
	schedule_lap.custom_minimum_size.x = 65; plan_row.add_child(schedule_lap)
	schedule_button = UI.button("Schedule", func(): dispatch("schedule_pit", {"lap": int(schedule_lap.value)})); schedule_button.custom_minimum_size.x = 78; schedule_button.add_theme_font_size_override("font_size", 12); plan_row.add_child(schedule_button)
	unschedule_button = UI.button("Cancel planned stop", func(): dispatch("cancel_schedule")); planning.add_child(unschedule_button)
	schedule_label = UI.paragraph(""); schedule_label.add_theme_font_size_override("font_size", 11); planning.add_child(schedule_label)
	stint_plot = StintPlot.new(); stint_plot.sim = sim; planning.add_child(stint_plot)
	tyre_summary = UI.paragraph(""); tyre_summary.add_theme_font_size_override("font_size", 12); planning.add_child(tyre_summary)
	var setup_page = tab_page("Setup")
	racecraft = RacecraftPanel.new(); racecraft.configure(sim, dispatch); setup_page.add_child(racecraft)
	setup_commit = UI.vbox(wall); setup_commit.add_theme_constant_override("separation", 3); setup_commit.visible = false
	racecraft.actions.reparent(setup_commit); racecraft.note.reparent(setup_commit)
	pin_navigation(0, drive_sections); show_drive(0)
	pin_navigation(3, tyre_sections)
	var lab_page = tab_page("Surface lab")
	surface_lab = SurfaceLab.new(); surface_lab.sim = sim; surface_lab.canvas = canvas; lab_page.add_child(surface_lab)
	pit_note = UI.paragraph(""); pit_note.add_theme_font_size_override("font_size", 12); wall.add_child(pit_note)
	var pit_row = UI.hbox(wall)
	box_button = UI.button("Box at next entry", func(): dispatch("pit"), true); box_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL; pit_row.add_child(box_button)
	cancel_box = UI.button("Cancel", func(): dispatch("cancel_pit")); pit_row.add_child(cancel_box)
	var runs = UI.hbox(wall)
	send_button = UI.button("Send out", func(): dispatch("send"), true); send_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL; runs.add_child(send_button)
	recall_button = UI.button("Recall", func(): dispatch("recall")); runs.add_child(recall_button)
	detail_actions = UI.vbox(wall); detail_actions.add_theme_constant_override("separation", 4)
	for entry in [["Drive", 0], ["Tyres", 3], ["Setup", 4], ["Telemetry", 1], ["Radio", 2], ["Surface", 5]]: register_topic(entry[0], entry[1])
	hint = UI.paragraph(""); hint.add_theme_font_size_override("font_size", 12); add_child(hint)
	radio_label = UI.label("", 11, UI.MUTED); add_child(radio_label)
	refresh(); setup_guide(); call_deferred("wire_control_help", self)
	call_deferred("fit_canvas")

func setup_guide() -> void:
	guide = ContextGuide.new()
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
	var scroll = ScrollContainer.new(); scroll.name = title; scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED; tabs.add_child(scroll)
	var margin = MarginContainer.new(); margin.size_flags_horizontal = Control.SIZE_EXPAND_FILL; scroll.add_child(margin)
	for side in ["left", "right", "top", "bottom"]: margin.add_theme_constant_override("margin_" + side, 5)
	var page = UI.vbox(margin); page.add_theme_constant_override("separation", 6)
	return page

func fit_canvas() -> void: canvas.fit()

func set_follow(value: bool) -> void:
	follow = value
	if value and canvas: canvas.fit_view_enabled = false
	if follow_control: follow_control.set_pressed_no_signal(value)

func select_driver(id: int) -> void:
	if id < 0 or id >= sim.cars.size(): return
	sim.selected_id = id; refresh()

func feedback(text: String) -> void:
	radio_label.text = text; feedback_until = Time.get_ticks_msec() / 1000.0 + 5

func dispatch(action: String, payload: Dictionary = {}) -> void:
	payload.id = sim.selected_id
	if not sim.command(action, payload): feedback(sim.last_error)
	elif action not in ["pause", "speed"]: feedback("%s · %s acknowledged" % [sim.cars[sim.selected_id].short, action.replace("_", " ")])
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

func _process(delta: float) -> void:
	if sim == null: return
	sim.advance(delta)
	if follow and canvas:
		var alpha = clampf(sim.accumulator / RaceSim.STEP, 0, 1) if not sim.paused else 1.0
		var p = sim.car_position(sim.cars[sim.selected_id], alpha).p
		var next = canvas.center.lerp(p, 1.0 if App.settings.reduced_motion or canvas.center.distance_squared_to(p) < 0.0001 else 1.0 - exp(-delta * 7))
		if canvas.center != next: canvas.center = next; canvas.queue_redraw()
	refresh_time -= delta
	if refresh_time <= 0: refresh_time = 0.2; refresh()

func refresh() -> void:
	ui_refresh_count += 1
	if tower == null: return
	var c = sim.cars[sim.selected_id]
	surface_control.set_pressed_no_signal(canvas.show_surface)
	compact_resources.text = "TYRES %d%%   ·   FUEL %.1f laps   ·   CAR %d%%" % [c.tyre, c.fuel, c.health]
	var q = sim.phase in ["practice", "practice_results", "qualifying", "qualifying_results"]
	var order = sim.standings(q); var leader = order[0]
	rows.clear(); tower.set_block_signals(true)
	for i in range(order.size()):
		var car = order[i]; var row = rank_rows[i]; rows[car.id] = row
		var text = "LEADER" if i == 0 else "~+%.1fs" % [maxf(0, leader.distance - car.distance) / maxf(15, car.speed)]
		if q: text = RaceSim.format_time(car.qual_best)
		elif car.dnf: text = "DNF"
		elif sim.phase in ["briefing", "race_preparation", "formation", "grid_ready", "lights"]: text = "GRID %d" % car.grid
		elif car.finished:
			text = "WINNER" if i == 0 else ("+%d L" % (leader.completed - car.completed) if car.completed < leader.completed else "+%.3f" % (car.finish_time - leader.finish_time))
		elif leader.distance - car.distance >= sim.track.length: text = "+%d L" % int((leader.distance - car.distance) / sim.track.length)
		var state = "DNF" if car.dnf else ("FIN" if car.finished else ("PIT" if car.route == "pit" else ({"garage": "BOX", "outlap": "OUT", "hotlap": "HOT", "inlap": "IN"}.get(car.qual_state, "") if q else ("BLUE" if car.blue else "%d%%" % car.tyre))))
		var tooltip = "%s · %s\n%s\nTyres %.0f%% · %s\nBest %s" % [car.name, car.team, car.intent, car.tyre, car.compound, RaceSim.format_time(car.qual_best if q else car.best_lap)]
		var appearance = [car.id, text, car.compound, state, tooltip, car.id == sim.selected_id]
		if rendered_rows.get(i) != appearance:
			rendered_rows[i] = appearance
			row.set_text(0, str(i + 1)); row.set_text(1, car.short); row.set_custom_color(1, Color(car.color).darkened(0.32)); row.set_metadata(0, car.id)
			row.set_text(2, text); row.set_text(3, car.compound); row.set_text(4, state)
			row.set_custom_color(4, UI.ACCENT if state == "HOT" else (UI.DANGER if car.dnf else UI.MUTED))
			for column in range(5):
				row.set_tooltip_text(column, tooltip)
				row.set_custom_bg_color(column, Color("dbe3ca") if car.id == sim.selected_id else (Color("edf0dc") if car.player else UI.PANEL))
		if car.id == sim.selected_id and not row.is_selected(0): row.select(0)
	tower.set_block_signals(false)
	var captions = {"practice": "End practice…", "practice_results": "Return to briefing", "briefing": "Start qualifying", "qualifying": "Close qualifying…", "qualifying_results": "Prepare the race", "race_preparation": "Start formation lap", "formation": "Formation in progress", "grid_ready": "Release start lights", "lights": "Start lights", "race": "Race in progress", "results": "Another weekend"}
	primary_button.text = captions[sim.phase]; primary_button.disabled = sim.phase in ["formation", "lights", "race"] or sim.phase == "qualifying" and sim.qual_closed
	primary_button.tooltip_text = "Finish the active session before advancing." if primary_button.disabled else "Advance to the next weekend stage."
	pause_button.text = "Resume" if sim.paused else "Pause"; pause_button.disabled = sim.phase not in RaceSim.ACTIVE
	speed_control.select([1, 2, 4, 8, 16].find(sim.speed))
	flag_label.text = "PAUSED" if sim.paused else ("CHEQUERED" if sim.chequered or q and sim.qual_closed else sim.flag)
	flag_label.add_theme_color_override("font_color", UI.ACCENT if sim.paused or sim.flag != "GREEN" else UI.GOOD)
	var running_lap = clampi(int(floor(maxf(0, leader.distance) / sim.track.length)) + 1, 1, sim.laps)
	clock_label.text = "QUAL %s" % RaceSim.format_time(maxf(0.001, sim.qual_duration - sim.clock)) if q and sim.phase != "qualifying_results" else ("LAP %d / %d · %s" % [running_lap, sim.laps, RaceSim.format_time(sim.race_time)] if sim.phase in ["race", "results"] else sim.phase.replace("_", " ").to_upper())
	weather_label.text = "%s · Water %d%%" % [sim.weather_name, int(sim.average(sim.water) * 100)]
	weather_label.tooltip_text = "Rubber %d%%. Rain and surface water are separate: the road wets and dries gradually." % int(sim.average(sim.rubber) * 100)
	session_label.text = "%s   /   %s   /   SEED %d" % [sim.phase.replace("_", " ").to_upper(), sim.track.preset.to_upper(), sim.seed_value]
	var step_index = {"practice": 0, "practice_results": 0, "briefing": 0, "qualifying": 0, "qualifying_results": 0, "race_preparation": 1, "formation": 2, "grid_ready": 3, "lights": 3, "race": 4, "results": 5}[sim.phase]
	steps[0].get_parent().visible = sim.phase not in RaceSim.ACTIVE
	for i in range(steps.size()): steps[i].add_theme_color_override("font_color", UI.ACCENT if i == step_index else (UI.GOOD if i < step_index else UI.MUTED))
	for i in range(2):
		var teammate = sim.cars[[3, 6][i]]
		teammate_buttons[i].text = "%s · P%d" % [teammate.short, order.find(teammate) + 1]
		UI.set_active(teammate_buttons[i], teammate.id == c.id)
	driver_label.text = "%02d  %s" % [c.number, c.name]; driver_label.add_theme_color_override("font_color", Color(c.color).darkened(0.35))
	intent_label.text = "Finished P%d" % c.finish_position if c.finished else ("Retired: " + c.retire_reason if c.dnf else c.intent); intent_label.tooltip_text = intent_label.text
	var values = [c.tyre, c.fuel, c.health]
	for i in range(3):
		resource_labels[i].text = "%.1f laps" % values[i] if i == 1 else "%d%%" % values[i]
		resource_bars[i].value = clampf(values[i] / maxf(1, sim.laps) * 100, 0, 100) if i == 1 else values[i]
	if right_panel.visible and tabs.current_tab == 1:
		telemetry_label.text = "%d km/h · %d°C tyres\nThrottle %d%% · Brake %d%%\nDamage %d%% · Pit stops %d\nBest  %s\nLast   %s\nS1 %s\nS2 %s\nS3 %s" % [c.speed * 3.6, c.temperature, c.throttle * 100, c.braking * 100, c.damage, c.pit_stops, RaceSim.format_time(c.qual_best if q else c.best_lap), RaceSim.format_time(c.last_lap), RaceSim.format_time(c.sectors[0]), RaceSim.format_time(c.sectors[1]), RaceSim.format_time(c.sectors[2])]
		var records: Array = c.qual_history if q else c.history
		var history: Array[String] = ["MEASURED FLYING LAPS" if q else "RACE LAP HISTORY"]
		for i in range(maxi(0, records.size() - 8), records.size()):
			var lap = records[i]
			history.append("%s %d   %s%s" % ["Run" if q else "Lap", lap.get("run", lap.get("lap", 0)), RaceSim.format_time(lap.time), " · INVALID" if not lap.get("valid", true) else (" · PIT" if lap.get("pit_lap", false) else "")])
			if q and lap.has("sectors"): history.append("%.2f / %.2f / %.2f" % [lap.sectors[0], lap.sectors[1], lap.sectors[2]])
		history_label.text = "\n\n".join(history)
	automate.set_pressed_no_signal(c.auto); repair.set_pressed_no_signal(c.repair)
	battle_picker.select(["patient", "balanced", "assertive"].find(c.battle_mode))
	pace.select(c.pace); engine.select(c.engine); compound.select(["S", "M", "H", "I", "W"].find(c.next_compound)); setup.set_value_no_signal(c.setup)
	var controllable = c.player and not c.dnf and not c.finished
	for button in [automate, pace, engine, compound, repair, battle_picker]: button.disabled = not controllable
	box_button.disabled = not controllable or sim.phase != "race" or c.route != "track" or c.pit_order and c.scheduled_lap < 1
	cancel_box.disabled = not controllable or not c.pit_order or c.route != "track"
	send_button.disabled = not controllable or sim.phase != "qualifying" or sim.qual_closed or c.route != "garage"
	recall_button.disabled = not controllable or sim.phase != "qualifying" or c.route != "track"
	box_button.get_parent().visible = not q; send_button.get_parent().visible = q
	pace.visible = not q; engine.visible = not q; repair.visible = not q
	setup.get_parent().visible = false # Complete setup has one staged editing surface.
	setup.editable = controllable and (sim.phase in ["briefing", "race_preparation"] or c.route == "garage")
	command_note.text = "Spectating a rival. Select MER or MOR to give commands." if not c.player else ("Engineer controls releases and strategy." if c.auto else "Manual control. Pace, engine and pit calls are yours.")
	pit_note.text = ("Existing hot laps may finish." if sim.qual_closed else "Garage → Out → Hot → In → Garage") if q else (sim.pit_status(c) if c.pit_order or c.route == "pit" else "Planned compound: %s · %s\nRecommended now: %s" % [c.next_compound, "repair" if c.repair else "tyres only", sim.recommended_compound()])
	box_button.tooltip_text = "Late calls defer safely to the following pit entry."; cancel_box.tooltip_text = "A car already in the pit lane cannot cancel entry."
	var signature = str(sim.events.back()) if not sim.events.is_empty() else ""
	if right_panel.visible and tabs.current_tab == 2 and (last_event_count != sim.events.size() or signature != last_event_signature):
		last_event_signature = signature
		last_event_count = sim.events.size()
		var lines: Array[String] = []
		for i in range(sim.events.size() - 1, -1, -1):
			if lines.size() >= 50: break
			var event = sim.events[i]
			if radio_filter != "all":
				var kinds = {"flags": ["flag", "incident", "finish"], "pit": ["pit", "radio"], "tyre": ["tyre"], "weather": ["weather"]}[radio_filter]
				if event.kind not in kinds: continue
			lines.append("%02d:%02d  %s" % [int(event.time / 60), int(fmod(event.time, 60)), event.text])
		log_label.text = "\n\n".join(lines) if not lines.is_empty() else "No matching events yet."
	var hints = {"practice": "Run a useful experiment; tyres, fuel, health and weather remain physical.", "practice_results": "Review measured findings, then return to briefing. No setup bonus is awarded.", "briefing": "Start qualifying. Engineers schedule runs; switch delegation off to manage releases yourself.", "qualifying": "Only complete hot laps set a time. OUT / HOT / IN / BOX are visible in the timing tower.", "qualifying_results": "The grid is set. Inspect measured splits in Telemetry, then prepare the race.", "race_preparation": "Select your starting tyres and setup. Formation warms the tyres but consumes fuel.", "formation": "One full formation lap. No overtaking; all cars return to their assigned grid slots.", "grid_ready": "The grid is ready. Release the lights when you are ready to start.", "lights": "Five red lights. Race distance begins at lights out.", "race": "Calls use the next safe pit-entry gate. Your pit buttons stay visible while inspecting telemetry or radio.", "results": "Final classification: completed laps first, then finish time. Pit laps are excluded from fastest-lap records."}
	hint.text = hints[sim.phase]
	if Time.get_ticks_msec() / 1000.0 > feedback_until:
		radio_label.text = "Space pause · 1–5 speed · Ctrl+Tab driver · B box · Esc close panel · F fit"
		if is_instance_valid(help_target) and not help_target.tooltip_text.is_empty(): radio_label.text = help_target.tooltip_text.replace("\n", " · ") + "   [F1 details]"
		radio_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	var advisories = sim.car_advisories(c)
	advisory_button.visible = not advisories.is_empty()
	if not advisories.is_empty():
		advisory_button.text = "Inspect · " + advisories[0].left(44)
		advisory_button.tooltip_text = "\n".join(advisories)
	if racecraft and racecraft.is_visible_in_tree(): racecraft.refresh(); detail_refresh_count += 1
	if wheel_dashboard and wheel_dashboard.is_visible_in_tree(): wheel_dashboard.refresh(); detail_refresh_count += 1
	if tabs.current_tab == 3 and right_panel.visible: refresh_tyres(c, controllable); detail_refresh_count += 1
	if trace.is_visible_in_tree(): trace.queue_redraw()
	if last_phase != sim.phase:
		last_phase = sim.phase
		var error = App.save_weekend()
		if not error.is_empty(): feedback("Autosave failed: " + error)

func save_checkpoint() -> void:
	var error = App.save_weekend()
	feedback("Weekend saved. Continue resumes this checkpoint." if error.is_empty() else error)

func export_log() -> void:
	var dialog = UI.file_dialog(self, true, ["*.json ; Weekend analysis log"], func(path):
		var data = {"kind": "motorsport-manager-race-log", "version": 2, "track": sim.track.document.name, "seed": sim.seed_value, "events": sim.events, "commands": sim.commands, "classification": sim.standings(), "phase": sim.phase, "stats": sim.stats}
		var error = Storage.write_json(path, data); feedback("Race log exported." if error.is_empty() else error))
	dialog.current_file = "weekend-log.json"

func _unhandled_key_input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo: return
	var focus = get_viewport().gui_get_focus_owner()
	if event.keycode == KEY_F1 and is_instance_valid(help_target) and not help_target.tooltip_text.is_empty():
		UI.notify(self, "Control help", help_target.tooltip_text); get_viewport().set_input_as_handled(); return
	if focus is LineEdit or focus is TextEdit: return
	if event.keycode == KEY_ESCAPE and right_panel.visible: close_detail(); get_viewport().set_input_as_handled()
	elif event.keycode == KEY_SPACE and sim.phase in RaceSim.ACTIVE: dispatch("pause"); get_viewport().set_input_as_handled()
	elif event.keycode == KEY_B and not box_button.disabled: dispatch("pit"); get_viewport().set_input_as_handled()
	elif event.keycode == KEY_TAB and event.ctrl_pressed: select_driver(6 if sim.selected_id == 3 else 3); get_viewport().set_input_as_handled()
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
	if tyre_buttons.is_empty(): return
	var planned = TyreInventory.planned(c, sim.phase == "race")
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
	driver_label.visible = not value; intent_label.visible = not value; resource_row.visible = not value
	compact_resources.visible = value; expand_button.text = "Collapse" if value else "Expand"
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
	if tabs.current_tab != index: tabs.current_tab = index
	else: refresh_navigation(); refresh()

func open_detail() -> void:
	if right_panel: right_panel.visible = true
	refresh_navigation()

func close_detail() -> void:
	if not right_panel: return
	detail_expanded = false; timing_panel.visible = true; right_panel.visible = false
	right_panel.custom_minimum_size.x = 360; expand_button.text = "Expand"
	trace.visible = false; refresh_navigation()
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
	if event.keycode != KEY_SPACE or sim == null or sim.phase not in RaceSim.ACTIVE: return
	if focus is LineEdit or focus is TextEdit: return
	dispatch("pause"); get_viewport().set_input_as_handled()
