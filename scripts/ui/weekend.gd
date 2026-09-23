class_name WeekendView
extends VBoxContainer
## Persistent native controls: live telemetry never rebuilds the timing tree or pit wall.
signal new_weekend_requested
var sim: RaceSim
var canvas: TrackCanvas
var tower: Tree
var rows: Dictionary = {}
var rank_rows: Array[TreeItem] = []
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
var steps: Array[Label] = []
var teammate_buttons: Array[Button] = []
var resource_labels: Array[Label] = []
var resource_bars: Array[ProgressBar] = []
var pit_note: Label
var command_note: Label
var tabs: TabContainer
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
	add_theme_constant_override("separation", 8)
	var heading = UI.hbox(self)
	var titles = UI.vbox(heading)
	title_label = UI.label(sim.track.document.name, 25); titles.add_child(title_label)
	session_label = UI.label("", 12, UI.MUTED); titles.add_child(session_label)
	var spacer = Control.new(); spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL; heading.add_child(spacer)
	primary_button = UI.button("Start qualifying", primary_action, true); primary_button.custom_minimum_size.x = 195; heading.add_child(primary_button)
	var progress = UI.hbox(self)
	for text in ["01  QUALIFYING", "02  PREPARATION", "03  FORMATION", "04  START", "05  RACE", "06  RESULTS"]:
		var step = UI.label(text, 11, UI.MUTED); step.size_flags_horizontal = Control.SIZE_EXPAND_FILL; progress.add_child(step); steps.append(step)
	var strip = HFlowContainer.new(); add_child(strip)
	pause_button = UI.button("Pause", func(): dispatch("pause")); strip.add_child(pause_button)
	speed_control = UI.option(["1×", "2×", "4×", "8×", "16×"], func(index): dispatch("speed", {"value": [1, 2, 4, 8, 16][index]})); strip.add_child(speed_control)
	clock_label = UI.label("", 14); clock_label.custom_minimum_size.x = 170; strip.add_child(clock_label)
	flag_label = UI.label("GREEN", 12, UI.GOOD); flag_label.custom_minimum_size.x = 115; strip.add_child(flag_label)
	weather_label = UI.label("", 12, UI.MUTED); strip.add_child(weather_label)
	strip.add_child(UI.button("Save", save_checkpoint)); strip.add_child(UI.button("Export log", export_log))
	var body = UI.hbox(self, true)
	var timing_panel = UI.panel(); timing_panel.custom_minimum_size.x = 276; body.add_child(timing_panel)
	var timing = UI.vbox(timing_panel, true)
	timing.add_child(UI.label("LIVE CLASSIFICATION", 12, UI.ACCENT))
	tower = Tree.new(); tower.select_mode = Tree.SELECT_ROW; tower.columns = 5; tower.hide_root = true; tower.hide_folding = true
	tower.column_titles_visible = true; tower.size_flags_vertical = Control.SIZE_EXPAND_FILL
	tower.add_theme_font_size_override("font_size", 12); tower.add_theme_font_size_override("title_button_font_size", 10)
	tower.add_theme_constant_override("v_separation", 9); tower.add_theme_constant_override("indent", 0)
	tower.add_theme_stylebox_override("panel", UI.box(UI.BG, UI.LINE, 6, 6))
	for i in range(5):
		tower.set_column_title(i, ["P", "CAR", "GAP / LAP", "TYRE", "STATE"][i]); tower.set_column_expand(i, false)
		tower.set_column_custom_minimum_width(i, [26, 42, 78, 34, 44][i])
	tower.item_selected.connect(func():
		var item = tower.get_selected()
		if item: select_driver(int(item.get_metadata(0))))
	timing.add_child(tower)
	var root_item = tower.create_item()
	for i in range(12): rank_rows.append(tower.create_item(root_item))
	timing.add_child(UI.paragraph("MER / MOR are your cars.\n~ Gaps are distance estimates.\nOUT → HOT → IN → BOX", UI.MUTED))
	var visual = UI.vbox(body, true)
	var view_row = HFlowContainer.new(); visual.add_child(view_row)
	view_row.add_child(UI.button("Fit [F]", func(): set_follow(false); canvas.fit()))
	follow_control = UI.check("Follow", false, set_follow); view_row.add_child(follow_control)
	view_row.add_child(UI.check("Line", App.settings.racing_line, func(value): canvas.show_line = value; canvas.queue_redraw()))
	view_row.add_child(UI.check("Labels", App.settings.labels, func(value): canvas.show_labels = value))
	view_row.add_child(UI.check("Surface", false, func(value): canvas.show_surface = value))
	canvas = TrackCanvas.new(); canvas.sim = sim; canvas.show_line = App.settings.racing_line; canvas.show_labels = App.settings.labels; canvas.show_grid = false
	canvas.set_track(sim.track); visual.add_child(canvas); canvas.car_selected.connect(select_driver)
	canvas.navigated.connect(func(): set_follow(false))
	trace = TelemetryPlot.new(); trace.sim = sim; visual.add_child(trace)
	var right = UI.panel(); right.custom_minimum_size.x = 304; body.add_child(right)
	var wall = UI.vbox(right, true); wall.add_theme_constant_override("separation", 7)
	wall.add_child(UI.label("OBSIDIAN / PIT WALL", 12, UI.ACCENT))
	var teammates = UI.hbox(wall)
	for id in [3, 6]:
		var b = UI.button("", func(): select_driver(id)); b.size_flags_horizontal = Control.SIZE_EXPAND_FILL; b.add_theme_font_size_override("font_size", 12)
		teammates.add_child(b); teammate_buttons.append(b)
	driver_label = UI.label("", 18, UI.ACCENT); wall.add_child(driver_label)
	intent_label = UI.label("", 12, UI.MUTED); intent_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS; wall.add_child(intent_label)
	var resources = UI.hbox(wall)
	for title in ["TYRES", "FUEL", "INTEGRITY"]:
		var cell = UI.vbox(resources); cell.size_flags_horizontal = Control.SIZE_EXPAND_FILL; cell.add_theme_constant_override("separation", 3)
		cell.add_child(UI.label(title, 10, UI.MUTED))
		var value = UI.label("", 14); cell.add_child(value); resource_labels.append(value)
		var bar = ProgressBar.new(); bar.show_percentage = false; bar.custom_minimum_size = Vector2(55, 4)
		bar.add_theme_stylebox_override("background", UI.box(UI.LINE, UI.LINE, 2, 0)); bar.add_theme_stylebox_override("fill", UI.box(UI.GOOD, UI.GOOD, 2, 0))
		cell.add_child(bar); resource_bars.append(bar)
	tabs = TabContainer.new(); tabs.size_flags_vertical = Control.SIZE_EXPAND_FILL; wall.add_child(tabs)
	var commands = tab_page("Commands")
	automate = UI.check("Delegate to engineer", true, func(value): dispatch("auto", {"value": value})); commands.add_child(automate)
	pace = UI.option(["Conserve pace", "Balanced pace", "Push pace"], func(index): dispatch("pace", {"value": index})); commands.add_child(pace)
	engine = UI.option(["Economy engine", "Standard engine", "Overtake engine"], func(index): dispatch("engine", {"value": index})); commands.add_child(engine)
	commands.add_child(UI.label("COMPOUND / NEXT STOP", 11, UI.MUTED))
	compound = UI.option(["S · Soft", "M · Medium", "H · Hard", "I · Intermediate", "W · Wet"], func(index): dispatch("compound", {"value": ["S", "M", "H", "I", "W"][index]})); commands.add_child(compound)
	commands.add_child(UI.button("Choose a fresh or used set →", func(): tabs.current_tab = 3))
	repair = UI.check("Repair damage at stop", true, func(value): dispatch("repair", {"value": value})); commands.add_child(repair)
	setup = UI.spin(5, 1, 9, 1, func(value): dispatch("setup", {"value": value})); UI.field(commands, "Cornering setup", setup)
	command_note = UI.paragraph("", UI.MUTED); command_note.add_theme_font_size_override("font_size", 12); commands.add_child(command_note)
	var telemetry = tab_page("Telemetry")
	telemetry_label = UI.label("", 14); telemetry.add_child(telemetry_label)
	history_label = RichTextLabel.new(); history_label.custom_minimum_size = Vector2(245, 215); history_label.add_theme_font_size_override("normal_font_size", 12); telemetry.add_child(history_label)
	var radio = tab_page("Radio")
	radio.add_child(UI.paragraph("Latest first. Reading radio does not pause a live session; use Space to pause."))
	log_label = RichTextLabel.new(); log_label.custom_minimum_size = Vector2(245, 300); log_label.selection_enabled = true; log_label.add_theme_font_size_override("normal_font_size", 12); radio.add_child(log_label)
	var tyres = tab_page("Tyres")
	tyres.add_child(UI.label("PLAN A SET · THEN BOX / SEND", 12, UI.ACCENT))
	var sets = GridContainer.new(); sets.columns = 3; tyres.add_child(sets)
	for index in range(12):
		var button = UI.button("", func(): dispatch("select_set", {"set_id": sim.cars[sim.selected_id].tyre_sets[index].id}))
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL; button.custom_minimum_size = Vector2(74, 47); button.add_theme_font_size_override("font_size", 10)
		sets.add_child(button); tyre_buttons.append(button)
	tyres.add_child(UI.label("PLANNED PIT STOP", 12, UI.ACCENT))
	var plan_row = UI.hbox(tyres)
	plan_row.add_child(UI.label("Racing lap", 12, UI.MUTED))
	schedule_lap = UI.spin(2, 1, maxi(1, sim.laps - 1), 1, func(_value): pass)
	schedule_lap.custom_minimum_size.x = 65; plan_row.add_child(schedule_lap)
	schedule_button = UI.button("Schedule", func(): dispatch("schedule_pit", {"lap": int(schedule_lap.value)})); schedule_button.custom_minimum_size.x = 78; schedule_button.add_theme_font_size_override("font_size", 12); plan_row.add_child(schedule_button)
	unschedule_button = UI.button("Cancel planned stop", func(): dispatch("cancel_schedule")); tyres.add_child(unschedule_button)
	schedule_label = UI.paragraph(""); schedule_label.add_theme_font_size_override("font_size", 11); tyres.add_child(schedule_label)
	stint_plot = StintPlot.new(); stint_plot.sim = sim; tyres.add_child(stint_plot)
	tyre_summary = UI.paragraph(""); tyre_summary.add_theme_font_size_override("font_size", 12); tyres.add_child(tyre_summary)
	pit_note = UI.paragraph(""); pit_note.add_theme_font_size_override("font_size", 12); wall.add_child(pit_note)
	var pit_row = UI.hbox(wall)
	box_button = UI.button("Box at next entry", func(): dispatch("pit"), true); box_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL; pit_row.add_child(box_button)
	cancel_box = UI.button("Cancel", func(): dispatch("cancel_pit")); pit_row.add_child(cancel_box)
	var runs = UI.hbox(wall)
	send_button = UI.button("Send out", func(): dispatch("send"), true); send_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL; runs.add_child(send_button)
	recall_button = UI.button("Recall", func(): dispatch("recall")); runs.add_child(recall_button)
	hint = UI.paragraph(""); hint.add_theme_font_size_override("font_size", 12); add_child(hint)
	radio_label = UI.label("", 11, UI.MUTED); add_child(radio_label)
	refresh(); call_deferred("fit_canvas")

func tab_page(title: String) -> VBoxContainer:
	var scroll = ScrollContainer.new(); scroll.name = title; scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED; tabs.add_child(scroll)
	var margin = MarginContainer.new(); margin.size_flags_horizontal = Control.SIZE_EXPAND_FILL; scroll.add_child(margin)
	for side in ["left", "right", "top", "bottom"]: margin.add_theme_constant_override("margin_" + side, 8)
	var page = UI.vbox(margin); page.add_theme_constant_override("separation", 8)
	return page

func fit_canvas() -> void: canvas.fit()

func set_follow(value: bool) -> void:
	follow = value
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
		canvas.center = canvas.center.lerp(p, 1.0 if App.settings.reduced_motion else 1.0 - exp(-delta * 7)); canvas.queue_redraw()
	refresh_time -= delta
	if refresh_time <= 0: refresh_time = 0.2; refresh()

func refresh() -> void:
	if tower == null: return
	var c = sim.cars[sim.selected_id]
	var q = sim.phase in ["qualifying", "qualifying_results"]
	var order = sim.standings(q); var leader = order[0]
	rows.clear(); tower.set_block_signals(true)
	for i in range(order.size()):
		var car = order[i]; var row = rank_rows[i]; rows[car.id] = row
		row.set_text(0, str(i + 1)); row.set_text(1, car.short); row.set_custom_color(1, Color(car.color).darkened(0.32)); row.set_metadata(0, car.id)
		var text = "LEADER" if i == 0 else "~+%.1fs" % [maxf(0, leader.distance - car.distance) / maxf(15, car.speed)]
		if q: text = RaceSim.format_time(car.qual_best)
		elif car.dnf: text = "DNF"
		elif sim.phase in ["briefing", "race_preparation", "formation", "grid_ready", "lights"]: text = "GRID %d" % car.grid
		elif car.finished:
			text = "WINNER" if i == 0 else ("+%d L" % (leader.completed - car.completed) if car.completed < leader.completed else "+%.3f" % (car.finish_time - leader.finish_time))
		elif leader.distance - car.distance >= sim.track.length: text = "+%d L" % int((leader.distance - car.distance) / sim.track.length)
		row.set_text(2, text); row.set_text(3, car.compound)
		var state = "DNF" if car.dnf else ("FIN" if car.finished else ("PIT" if car.route == "pit" else ({"garage": "BOX", "outlap": "OUT", "hotlap": "HOT", "inlap": "IN"}.get(car.qual_state, "") if q else ("BLUE" if car.blue else "%d%%" % car.tyre))))
		row.set_text(4, state); row.set_custom_color(4, UI.ACCENT if state == "HOT" else (UI.DANGER if car.dnf else UI.MUTED))
		for column in range(5):
			row.set_tooltip_text(column, "%s · %s\n%s\nTyres %.0f%% · %s\nBest %s" % [car.name, car.team, car.intent, car.tyre, car.compound, RaceSim.format_time(car.qual_best if q else car.best_lap)])
			row.set_custom_bg_color(column, Color("dbe3ca") if car.id == sim.selected_id else (Color("edf0dc") if car.player else UI.PANEL))
		if car.id == sim.selected_id: row.select(0)
	tower.set_block_signals(false)
	var captions = {"briefing": "Start qualifying", "qualifying": "Close qualifying…", "qualifying_results": "Prepare the race", "race_preparation": "Start formation lap", "formation": "Formation in progress", "grid_ready": "Release start lights", "lights": "Start lights", "race": "Race in progress", "results": "Another weekend"}
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
	var step_index = {"briefing": 0, "qualifying": 0, "qualifying_results": 0, "race_preparation": 1, "formation": 2, "grid_ready": 3, "lights": 3, "race": 4, "results": 5}[sim.phase]
	for i in range(steps.size()): steps[i].add_theme_color_override("font_color", UI.ACCENT if i == step_index else (UI.GOOD if i < step_index else UI.MUTED))
	for i in range(2):
		var teammate = sim.cars[[3, 6][i]]
		teammate_buttons[i].text = "%02d %s  P%d\n%s %.0f%% · %s" % [teammate.number, teammate.short, order.find(teammate) + 1, teammate.compound, teammate.tyre, "AUTO" if teammate.auto else "MANUAL"]
		teammate_buttons[i].add_theme_stylebox_override("normal", UI.box(UI.CARD, Color(teammate.color) if teammate.id == c.id else UI.LINE))
	driver_label.text = "%02d  %s" % [c.number, c.name]; driver_label.add_theme_color_override("font_color", Color(c.color).darkened(0.35))
	intent_label.text = "Finished P%d" % c.finish_position if c.finished else ("Retired: " + c.retire_reason if c.dnf else c.intent); intent_label.tooltip_text = intent_label.text
	var values = [c.tyre, c.fuel, c.health]
	for i in range(3):
		resource_labels[i].text = "%.1f laps" % values[i] if i == 1 else "%d%%" % values[i]
		resource_bars[i].value = clampf(values[i] / maxf(1, sim.laps) * 100, 0, 100) if i == 1 else values[i]
	telemetry_label.text = "%d km/h · %d°C tyres\nThrottle %d%% · Brake %d%%\nDamage %d%% · Pit stops %d\nBest  %s\nLast   %s\nS1 %s\nS2 %s\nS3 %s" % [c.speed * 3.6, c.temperature, c.throttle * 100, c.braking * 100, c.damage, c.pit_stops, RaceSim.format_time(c.qual_best if q else c.best_lap), RaceSim.format_time(c.last_lap), RaceSim.format_time(c.sectors[0]), RaceSim.format_time(c.sectors[1]), RaceSim.format_time(c.sectors[2])]
	var records: Array = c.qual_history if q else c.history
	var history: Array[String] = ["MEASURED FLYING LAPS" if q else "RACE LAP HISTORY"]
	for i in range(maxi(0, records.size() - 8), records.size()):
		var lap = records[i]
		history.append("%s %d   %s%s" % ["Run" if q else "Lap", lap.get("run", lap.get("lap", 0)), RaceSim.format_time(lap.time), " · INVALID" if not lap.get("valid", true) else (" · PIT" if lap.get("pit_lap", false) else "")])
		if q and lap.has("sectors"): history.append("%.2f / %.2f / %.2f" % [lap.sectors[0], lap.sectors[1], lap.sectors[2]])
	history_label.text = "\n\n".join(history)
	automate.set_pressed_no_signal(c.auto); repair.set_pressed_no_signal(c.repair)
	pace.select(c.pace); engine.select(c.engine); compound.select(["S", "M", "H", "I", "W"].find(c.next_compound)); setup.set_value_no_signal(c.setup)
	var controllable = c.player and not c.dnf and not c.finished
	for button in [automate, pace, engine, compound, repair]: button.disabled = not controllable
	box_button.disabled = not controllable or sim.phase != "race" or c.route != "track" or c.pit_order and c.scheduled_lap < 1
	cancel_box.disabled = not controllable or not c.pit_order or c.route != "track"
	send_button.disabled = not controllable or sim.phase != "qualifying" or sim.qual_closed or c.route != "garage"
	recall_button.disabled = not controllable or sim.phase != "qualifying" or c.route != "track"
	box_button.get_parent().visible = not q; send_button.get_parent().visible = q
	pace.visible = not q; engine.visible = not q; repair.visible = not q
	setup.get_parent().visible = sim.phase in ["briefing", "qualifying", "race_preparation"]
	setup.editable = controllable and (sim.phase in ["briefing", "race_preparation"] or c.route == "garage")
	command_note.text = "Spectating a rival. Select MER or MOR to give commands." if not c.player else ("Engineer controls releases and strategy." if c.auto else "Manual control. Pace, engine and pit calls are yours.")
	pit_note.text = ("Existing hot laps may finish." if sim.qual_closed else "Garage → Out → Hot → In → Garage") if q else (sim.pit_status(c) if c.pit_order or c.route == "pit" else "Planned compound: %s · %s\nRecommended now: %s" % [c.next_compound, "repair" if c.repair else "tyres only", sim.recommended_compound()])
	box_button.tooltip_text = "Late calls defer safely to the following pit entry."; cancel_box.tooltip_text = "A car already in the pit lane cannot cancel entry."
	var signature = str(sim.events.back()) if not sim.events.is_empty() else ""
	if last_event_count != sim.events.size() or signature != last_event_signature:
		last_event_signature = signature
		last_event_count = sim.events.size()
		var lines: Array[String] = []
		for i in range(sim.events.size() - 1, maxi(-1, sim.events.size() - 50), -1):
			var event = sim.events[i]; lines.append("%02d:%02d  %s" % [int(event.time / 60), int(fmod(event.time, 60)), event.text])
		log_label.text = "\n\n".join(lines)
	var hints = {"briefing": "Start qualifying. Engineers schedule runs; switch delegation off to manage releases yourself.", "qualifying": "Only complete hot laps set a time. OUT / HOT / IN / BOX are visible in the timing tower.", "qualifying_results": "The grid is set. Inspect measured splits in Telemetry, then prepare the race.", "race_preparation": "Select your starting tyres and setup. Formation warms the tyres but consumes fuel.", "formation": "One full formation lap. No overtaking; all cars return to their assigned grid slots.", "grid_ready": "The grid is ready. Release the lights when you are ready to start.", "lights": "Five red lights. Race distance begins at lights out.", "race": "Calls use the next safe pit-entry gate. Your pit buttons stay visible while inspecting telemetry or radio.", "results": "Final classification: completed laps first, then finish time. Pit laps are excluded from fastest-lap records."}
	hint.text = hints[sim.phase]
	if Time.get_ticks_msec() / 1000.0 > feedback_until: radio_label.text = "SPACE pause  ·  1–5 speed  ·  F fit  ·  Click a car to inspect  ·  Pan / zoom releases follow camera"
	refresh_tyres(c, controllable)
	trace.queue_redraw()
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
	if focus is LineEdit or focus is TextEdit: return
	if event.keycode == KEY_SPACE and sim.phase in RaceSim.ACTIVE: dispatch("pause"); get_viewport().set_input_as_handled()
	elif event.keycode == KEY_F: set_follow(false); canvas.fit(); get_viewport().set_input_as_handled()
	elif event.keycode >= KEY_1 and event.keycode <= KEY_5: dispatch("speed", {"value": [1, 2, 4, 8, 16][event.keycode - KEY_1]}); get_viewport().set_input_as_handled()

func refresh_tyres(c: Dictionary, controllable: bool) -> void:
	if tyre_buttons.is_empty(): return
	var planned = TyreInventory.planned(c, sim.phase == "race")
	for i in range(12):
		var item = c.tyre_sets[i]; var button = tyre_buttons[i]
		var mounted = item.id == c.set_id
		var selected = not planned.is_empty() and item.id == planned.id
		var state = "FITTED" if mounted else ("PLANNED" if selected else ("USED" if item.used else "FRESH"))
		button.text = "%s  %d%%\n%s" % [item.label, item.life, state]
		button.disabled = not controllable or c.route == "pit" or item.life <= 1 or sim.phase == "race" and mounted
		button.add_theme_stylebox_override("normal", UI.box(Color("dce4cb") if selected else UI.CARD, UI.ACCENT if selected else UI.LINE, 4, 4))
		button.tooltip_text = "%s · %d°C · %.2f laps · %d mounts\nCondition and temperature persist when removed." % [item.id, item.temperature, item.laps, item.mounts]
	tyre_summary.text = sim.strategy_advice(c)
	schedule_button.disabled = not controllable or sim.phase != "race" or c.route != "track" or c.pit_order or sim.laps <= 1
	unschedule_button.disabled = not controllable or c.route != "track" or c.scheduled_lap < 1
	schedule_label.text = ("Booked for lap %d. Box cancels this plan and calls the next safe entry." % c.scheduled_lap) if c.scheduled_lap > 0 else "No stop scheduled. Lap numbers refer to the entry gate on that racing lap, not crossing the finish line."
	stint_plot.queue_redraw()
