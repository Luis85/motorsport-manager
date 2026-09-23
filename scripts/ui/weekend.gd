class_name WeekendView
extends VBoxContainer
signal new_weekend_requested
var sim: RaceSim
var canvas: TrackCanvas
var tower: Tree
var rows: Dictionary = {}
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
var box_button: Button
var cancel_box: Button
var send_button: Button
var recall_button: Button
var setup: SpinBox
var log_label: RichTextLabel
var trace: TelemetryPlot
var follow = false
var refresh_time = 0.0
var last_phase = ""
var hint: Label

class TelemetryPlot extends Control:
	var sim: RaceSim
	func _ready(): custom_minimum_size.y = 88
	func _draw():
		draw_style_box(UI.box(UI.PANEL), Rect2(Vector2.ZERO, size))
		draw_string(ThemeDB.fallback_font, Vector2(15, 21), "SELECTED CAR · SPEED TRACE · LAST 120s", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, UI.MUTED)
		if sim == null: return
		var samples = sim.cars[sim.selected_id].telemetry
		if samples.size() < 2: return
		var line = PackedVector2Array()
		for i in range(samples.size()):
			line.append(Vector2(15 + (size.x - 30) * i / maxf(1, samples.size() - 1), size.y - 13 - samples[i][1] / 340.0 * (size.y - 44)))
		draw_polyline(line, UI.GOOD, 1.6, true)

func configure(value: RaceSim) -> void:
	sim = value

func _ready() -> void:
	size_flags_vertical = Control.SIZE_EXPAND_FILL; size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var heading = UI.hbox(self)
	var titles = UI.vbox(heading)
	title_label = UI.label(sim.track.document.name, 25); titles.add_child(title_label)
	session_label = UI.label("BRIEFING → QUALIFYING → RACE PREPARATION → FORMATION → RACE → RESULTS", 12, UI.MUTED); titles.add_child(session_label)
	var spacer = Control.new(); spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL; heading.add_child(spacer)
	primary_button = UI.button("Start qualifying", primary_action, true); primary_button.custom_minimum_size.x = 195; heading.add_child(primary_button)
	var strip = HFlowContainer.new(); add_child(strip)
	pause_button = UI.button("Pause", func(): dispatch("pause")); strip.add_child(pause_button)
	strip.add_child(UI.option(["1×", "2×", "4×", "8×", "16×"], func(index): dispatch("speed", {"value": [1, 2, 4, 8, 16][index]}), [1, 2, 4, 8, 16].find(sim.speed)))
	clock_label = UI.label("", 15); clock_label.custom_minimum_size.x = 170; strip.add_child(clock_label)
	flag_label = UI.label("GREEN", 13, UI.GOOD); flag_label.custom_minimum_size.x = 125; strip.add_child(flag_label)
	weather_label = UI.label("", 13, UI.MUTED); weather_label.custom_minimum_size.x = 260; strip.add_child(weather_label)
	strip.add_child(UI.button("Save weekend", save_checkpoint))
	strip.add_child(UI.button("Export race log", export_log))
	var body = UI.hbox(self, true)
	var timing_panel = UI.panel(); timing_panel.custom_minimum_size.x = 270; body.add_child(timing_panel)
	var timing = UI.vbox(timing_panel, true)
	timing.add_child(UI.label("LIVE CLASSIFICATION", 13, UI.ACCENT))
	tower = Tree.new(); tower.add_theme_font_size_override("font_size", 13); tower.add_theme_font_size_override("title_button_font_size", 12); tower.add_theme_constant_override("v_separation", 4); tower.columns = 4; tower.hide_root = true; tower.hide_folding = true; tower.add_theme_constant_override("indent", 0); tower.column_titles_visible = true; tower.size_flags_vertical = Control.SIZE_EXPAND_FILL
	for i in range(4): tower.set_column_title(i, ["P", "CAR", "GAP / LAP", "TYRE"][i]); tower.set_column_expand(i, false)
	tower.set_column_custom_minimum_width(0, 22); tower.set_column_custom_minimum_width(1, 42); tower.set_column_custom_minimum_width(2, 90); tower.set_column_custom_minimum_width(3, 43)
	tower.item_selected.connect(func():
		var item = tower.get_selected()
		if item: select_driver(int(item.get_metadata(0))))
	timing.add_child(tower)
	timing.add_child(UI.paragraph("Gold and teal are your Obsidian cars. Select any car to inspect; commands are limited to your two drivers."))
	var visual = UI.vbox(body, true)
	var view_row = UI.hbox(visual)
	view_row.add_child(UI.label("CIRCUIT FEED", 12, UI.MUTED))
	view_row.add_child(UI.button("Fit", func(): follow = false; canvas.fit()))
	view_row.add_child(UI.check("Follow", false, func(value): follow = value))
	view_row.add_child(UI.check("Line", App.settings.racing_line, func(value): canvas.show_line = value; canvas.queue_redraw()))
	view_row.add_child(UI.check("Labels", App.settings.labels, func(value): canvas.show_labels = value))
	canvas = TrackCanvas.new(); canvas.sim = sim; canvas.show_line = App.settings.racing_line; canvas.show_labels = App.settings.labels; canvas.show_grid = false
	canvas.set_track(sim.track); visual.add_child(canvas); canvas.car_selected.connect(select_driver)
	trace = TelemetryPlot.new(); trace.sim = sim; visual.add_child(trace)
	var right = UI.panel(); right.custom_minimum_size.x = 305; body.add_child(right)
	var scroll = ScrollContainer.new(); scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED; right.add_child(scroll)
	var wall = UI.vbox(scroll, true)
	wall.add_child(UI.label("OBSIDIAN / PIT WALL", 12, UI.ACCENT))
	var drivers = UI.hbox(wall)
	drivers.add_child(UI.button("08  MERCER", func(): select_driver(3)))
	drivers.add_child(UI.button("09  MOREAU", func(): select_driver(6)))
	driver_label = UI.label("", 20); wall.add_child(driver_label)
	telemetry_label = UI.label("", 15); wall.add_child(telemetry_label)
	intent_label = UI.paragraph("", UI.ACCENT); wall.add_child(intent_label)
	automate = UI.check("Delegate to engineer", true, func(value): dispatch("auto", {"value": value})); wall.add_child(automate)
	pace = UI.option(["Conserve tyres", "Balanced pace", "Push pace"], func(index): dispatch("pace", {"value": index}), 1)
	engine = UI.option(["Save fuel", "Standard engine", "Attack engine"], func(index): dispatch("engine", {"value": index}), 1)
	wall.add_child(pace); wall.add_child(engine)
	wall.add_child(UI.label("TYRES / NEXT PIT STOP", 12, UI.MUTED))
	compound = UI.option(["S · Soft", "M · Medium", "H · Hard", "I · Intermediate", "W · Wet"], func(index): dispatch("compound", {"value": ["S", "M", "H", "I", "W"][index]}), 1)
	wall.add_child(compound)
	var pit_row = UI.hbox(wall)
	box_button = UI.button("Box this lap", func(): dispatch("pit"), true); pit_row.add_child(box_button)
	cancel_box = UI.button("Cancel", func(): dispatch("cancel_pit")); pit_row.add_child(cancel_box)
	wall.add_child(UI.label("QUALIFYING / GARAGE", 12, UI.MUTED))
	var runs = UI.hbox(wall)
	send_button = UI.button("Send out", func(): dispatch("send")); runs.add_child(send_button)
	recall_button = UI.button("Recall", func(): dispatch("recall")); runs.add_child(recall_button)
	setup = UI.spin(5, 1, 9, 1, func(value): dispatch("setup", {"value": value}))
	UI.field(wall, "Cornering setup", setup)
	wall.add_child(UI.paragraph("Manual pace, engine or pit calls turn delegation off. Tyres selected in the garage are fitted immediately; on track they are planned for the next stop."))
	wall.add_child(UI.label("RACE CONTROL / RADIO", 12, UI.ACCENT))
	log_label = RichTextLabel.new(); log_label.custom_minimum_size = Vector2(245, 220); log_label.bbcode_enabled = false; log_label.selection_enabled = true; log_label.add_theme_font_size_override("normal_font_size", 12); wall.add_child(log_label)
	hint = UI.paragraph("", UI.MUTED); add_child(hint)
	radio_label = UI.label("", 12, UI.MUTED); add_child(radio_label)
	refresh(); call_deferred("fit_canvas")

func fit_canvas() -> void:
	canvas.fit()

func select_driver(id: int) -> void:
	sim.selected_id = id; refresh()

func dispatch(action: String, payload: Dictionary = {}) -> void:
	payload.id = sim.selected_id
	if not sim.command(action, payload): UI.notify(self, "Command unavailable", sim.last_error)
	refresh()

func primary_action() -> void:
	match sim.phase:
		"briefing": dispatch("qualify")
		"qualifying": dispatch("close_qualifying")
		"qualifying_results": dispatch("prepare_race")
		"race_preparation": dispatch("formation")
		"grid_ready": dispatch("lights")
		"results": new_weekend_requested.emit()

func _process(delta: float) -> void:
	if sim == null: return
	sim.advance(delta)
	if follow and canvas:
		var p = sim.car_position(sim.cars[sim.selected_id]).p
		canvas.center = canvas.center.lerp(p, minf(1, delta * 5)); canvas.queue_redraw()
	refresh_time -= delta
	if refresh_time <= 0: refresh_time = 0.2; refresh()

func refresh() -> void:
	if tower == null: return
	var c = sim.cars[sim.selected_id]
	var q = sim.phase in ["qualifying", "qualifying_results"]
	var order = sim.standings(q)
	tower.clear(); rows.clear(); var root_item = tower.create_item()
	var leader = order[0]
	for i in range(order.size()):
		var car = order[i]; var row = tower.create_item(root_item); rows[car.id] = row
		row.set_text(0, str(i + 1)); row.set_text(1, car.short); row.set_custom_color(1, Color(car.color)); row.set_metadata(0, car.id)
		var text = "LEADER" if i == 0 else "~+%.1fs" % [maxf(0, leader.distance - car.distance) / maxf(15, car.speed)]
		if q: text = RaceSim.format_time(car.qual_best)
		elif car.dnf: text = "DNF"
		elif sim.phase in ["briefing", "race_preparation", "formation", "grid_ready", "lights"]: text = "GRID %d" % car.grid
		elif car.finished:
			text = "WINNER" if i == 0 else ("+%d L" % (leader.completed - car.completed) if car.completed < leader.completed else "+%.3f" % (car.finish_time - leader.finish_time))
		elif car.route == "pit": text = "PIT"
		elif leader.completed - car.completed > 1: text = "+%d L" % (leader.completed - car.completed - 1)
		row.set_text(2, text); row.set_text(3, "%s %d" % [car.compound, int(car.tyre)])
		for column in range(4): row.set_tooltip_text(column, "%s · %s\n%s\nBest lap %s\nQualifying: %s" % [car.name, car.team, car.intent, RaceSim.format_time(car.best_lap), car.qual_state])
		if car.id == sim.selected_id:
			for column in range(4): row.set_custom_bg_color(column, Color("344039"))
	var captions = {"briefing": "Start qualifying", "qualifying": "Close qualifying", "qualifying_results": "Prepare the race", "race_preparation": "Start formation lap", "formation": "Formation in progress", "grid_ready": "Release start lights", "lights": "Start lights", "race": "Race in progress", "results": "Another weekend"}
	primary_button.text = captions[sim.phase]
	primary_button.disabled = sim.phase in ["formation", "lights", "race"] or sim.phase == "qualifying" and sim.qual_closed
	pause_button.text = "Resume" if sim.paused else "Pause"
	pause_button.disabled = sim.phase not in RaceSim.ACTIVE
	flag_label.text = "PAUSED" if sim.paused else ("CHEQUERED" if sim.chequered else sim.flag)
	flag_label.add_theme_color_override("font_color", UI.GOOD if sim.flag == "GREEN" else UI.ACCENT)
	var running_lap = clampi(int(floor(maxf(0, leader.distance) / sim.track.length)) + 1, 1, sim.laps)
	clock_label.text = "QUAL  %s" % RaceSim.format_time(maxf(0.001, sim.qual_duration - sim.clock)) if q and sim.phase != "qualifying_results" else ("LAP %d / %d  ·  %s" % [running_lap, sim.laps, RaceSim.format_time(sim.race_time)] if sim.phase in ["race", "results"] else sim.phase.replace("_", " ").to_upper())
	weather_label.text = "%s · Water %d%% · Rubber %d%%" % [sim.weather_name, int(sim.average(sim.water) * 100), int(sim.average(sim.rubber) * 100)]
	session_label.text = "CURRENT: %s   /   %s   /   SEED %d" % [sim.phase.replace("_", " ").to_upper(), sim.track.preset.to_upper(), sim.seed_value]
	driver_label.text = "%02d  %s" % [c.number, c.name]
	driver_label.add_theme_color_override("font_color", Color(c.color))
	telemetry_label.text = "%3d km/h       %s  %d%% tyres\n%.1f lap-eq fuel    %d°C tyres\n%d%% car health    %d%% damage\nBest  %s\nLast   %s\nS1 %.1f   S2 %.1f   S3 %.1f" % [int(c.speed * 3.6), c.compound, int(c.tyre), c.fuel, int(c.temperature), int(c.health), int(c.damage), RaceSim.format_time(c.best_lap if not q else c.qual_best), RaceSim.format_time(c.last_lap), c.sectors[0], c.sectors[1], c.sectors[2]]
	intent_label.text = ("Finished P%d" % c.finish_position) if c.finished else ("Retired: " + c.retire_reason if c.dnf else c.intent)
	automate.set_pressed_no_signal(c.auto)
	pace.select(c.pace); engine.select(c.engine); compound.select(["S", "M", "H", "I", "W"].find(c.next_compound)); setup.set_value_no_signal(c.setup)
	var controllable = c.player and not c.dnf and not c.finished
	for button in [automate, pace, engine, compound]: button.disabled = not controllable
	box_button.disabled = not controllable or sim.phase != "race" or c.route != "track" or c.pit_order
	cancel_box.disabled = not controllable or not c.pit_order or c.route != "track"
	send_button.disabled = not controllable or sim.phase != "qualifying" or sim.qual_closed or c.route != "garage"
	recall_button.disabled = not controllable or sim.phase != "qualifying" or c.route != "track"
	box_button.get_parent().visible = not q
	send_button.get_parent().visible = q
	pace.visible = not q; engine.visible = not q
	setup.get_parent().visible = sim.phase in ["briefing", "qualifying", "race_preparation"]
	setup.editable = controllable and (sim.phase in ["briefing", "race_preparation"] or c.route == "garage")
	var lines: Array[String] = []
	for i in range(sim.events.size() - 1, maxi(-1, sim.events.size() - 24), -1):
		var event = sim.events[i]; lines.append("%02d:%02d  %s" % [int(event.time / 60), int(fmod(event.time, 60)), event.text])
	log_label.text = "\n\n".join(lines)
	var hints = {
		"briefing": "Start qualifying to run timed laps. Your engineers schedule two runs per car; switch delegation off for manual send-out control.",
		"qualifying": "Only hot laps count. Cars drive garage → out-lap → hot lap → in-lap → garage. Close qualifying allows existing hot laps to finish.",
		"qualifying_results": "Qualifying is complete and the grid is set. Prepare the race when you are ready; the next session never starts automatically.",
		"race_preparation": "Choose starting tyres and cornering setup for MER and MOR. Then begin the formation lap. Race refuelling is disabled.",
		"formation": "The formation lap warms tyres and consumes fuel, but does not count towards race distance. Overtaking is disabled.",
		"grid_ready": "Every car is in its grid slot. Release the start lights when ready.",
		"lights": "Five red lights, then a standing start. Qualifying surface conditions carry into the race.",
		"race": "Choose your driver, pace, engine mode and next tyres. Box this lap commits at the pit-entry gate. Live gaps marked ~ are distance-based estimates.",
		"results": "Chequered. The timing tower is the final classification. Lapped cars finish at their next crossing; DNFs retain completed distance. Export the log for analysis."}
	hint.text = hints[sim.phase]
	radio_label.text = "SPACE pause / resume  ·  F fit view  ·  1–5 simulation speed  ·  Select a car on the circuit or timing tower"
	trace.queue_redraw()
	if last_phase != sim.phase:
		last_phase = sim.phase
		var error = App.save_weekend()
		if not error.is_empty(): radio_label.text = "Autosave failed: " + error

func save_checkpoint() -> void:
	var error = App.save_weekend()
	UI.notify(self, "Weekend checkpoint", "Saved. Continue weekend in the main menu resumes this state." if error.is_empty() else error)

func export_log() -> void:
	var dialog = UI.file_dialog(self, true, ["*.json ; Weekend analysis log"], func(path):
		var data = {"kind": "motorsport-manager-race-log", "version": 1, "track": sim.track.document.name, "seed": sim.seed_value, "events": sim.events, "commands": sim.commands, "classification": sim.standings(), "phase": sim.phase, "stats": sim.stats}
		var error = Storage.write_json(path, data)
		UI.notify(self, "Export log", "Race analysis log exported." if error.is_empty() else error))
	dialog.current_file = "weekend-log.json"

func _unhandled_key_input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo: return
	var focus = get_viewport().gui_get_focus_owner()
	if focus is LineEdit: return
	if event.keycode == KEY_SPACE and sim.phase in RaceSim.ACTIVE: dispatch("pause"); get_viewport().set_input_as_handled()
	elif event.keycode == KEY_F: follow = false; canvas.fit(); get_viewport().set_input_as_handled()
	elif event.keycode >= KEY_1 and event.keycode <= KEY_5: dispatch("speed", {"value": [1, 2, 4, 8, 16][event.keycode - KEY_1]}); get_viewport().set_input_as_handled()
