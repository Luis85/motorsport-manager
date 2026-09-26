class_name ReplayWorkspace
extends VBoxContainer
## An independent viewer. It has no original RaceSim reference or tactical commands.
signal close_requested
var player: RaceReplay
var playing = false
var budget = 16
var clock = 0.0
var mode_title: Label
var sandbox_return: Button
var return_button: Button
var play_button: Button
var branch_button: Button
var picker: OptionButton
var status: Label
var summary: Label
var canvas: TrackCanvas
var viewer: VBoxContainer
var sandbox_shell: VBoxContainer
var sandbox_view: PracticeWeekendView
var sandbox_record: RaceRecord
var last_error = ""
var export_scenario_button: Button
var author: ScenarioAuthor
var scenario_status: Label
var scenario_draft: Dictionary = {}
var scenario_details_button: Button

func configure(replay: RaceReplay) -> void:
	player = replay

func _ready() -> void:
	size_flags_horizontal = Control.SIZE_EXPAND_FILL; size_flags_vertical = Control.SIZE_EXPAND_FILL
	var heading = UI.hbox(self)
	mode_title = UI.label("REPLAY · NOT LIVE", 18, UI.ACCENT); mode_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL; heading.add_child(mode_title)
	return_button = UI.button("Return to original", request_close); heading.add_child(return_button)
	viewer = UI.vbox(self, true)
	var actions = UI.hbox(viewer)
	picker = UI.option(["Start of recording"], func(index): seek(index - 1)); picker.size_flags_horizontal = Control.SIZE_EXPAND_FILL; actions.add_child(picker)
	for mark in player.record.marks: picker.add_item(mark.label + " · step " + str(int(mark.step)))
	picker.add_item("Saved endpoint · not re-simulated")
	play_button = UI.button("Play record", toggle_play); actions.add_child(play_button)
	actions.add_child(UI.option(["Steady replay", "Fast replay", "Fastest replay"], func(index): budget = [16,32,64][index]))
	branch_button = UI.button("Try another decision", start_sandbox, true); actions.add_child(branch_button)
	status = UI.paragraph(""); viewer.add_child(status)
	canvas = TrackCanvas.new(); canvas.show_grid = false; viewer.add_child(canvas); canvas.custom_minimum_size = Vector2(300, 160)
	var card = UI.panel(); viewer.add_child(card); summary = UI.paragraph(""); card.add_child(summary)
	var footer = UI.hbox(viewer)
	footer.add_child(UI.button("Export recording", func(): export_data(player.record, "weekend.replay.json")))
	export_scenario_button = UI.button("Author scenario…", export_scenario); footer.add_child(export_scenario_button)
	footer.add_child(UI.paragraph("Sandbox = model experiment, not a guaranteed alternative result. No campaign rewards."))
	PitwallDesign.scale_controls(self, float(App.settings.pitwall_text_scale))
	seek(-1)
	PitwallDesign.focus_later(return_button)

func seek(index: int) -> void:
	playing = false
	if not player.seek(index): last_error = "That checkpoint is unavailable."
	else:
		last_error = ""; canvas.set_track(player.sim.track); canvas.sim = player.sim; canvas.call_deferred("fit")
	refresh()

func toggle_play() -> void:
	if player.verified or not player.error.is_empty(): return
	playing = not playing; refresh()

func _process(delta: float) -> void:
	if sandbox_view != null:
		clock += delta
		if clock >= 0.2 and scenario_status != null:
			clock = 0; scenario_status.text = ScenarioBrief.assessment(sandbox_record.parent.scenario, sandbox_view.sim)
		return
	if playing:
		player.tick(budget)
		if player.verified or not player.error.is_empty(): playing = false
	clock += delta
	if clock >= 0.2: clock = 0; refresh()

func refresh() -> void:
	if status == null or player.sim == null: return
	var state = "Saved checkpoint · not re-simulated" if player.at_snapshot else "Model re-simulation"
	if player.verified: state = "Verified continuation · %d reconstructed steps; endpoint agrees" % (player.step_index - player.start_step)
	if not player.error.is_empty(): state = player.error
	if not last_error.is_empty(): state = last_error
	status.text = "%s · %d / %d fixed steps · %s %.1fs" % [state, player.step_index, player.record.steps, player.sim.phase.replace("_", " "), player.sim.total_time]
	play_button.text = "Pause replay" if playing else "Play record"
	play_button.disabled = player.verified or not player.error.is_empty()
	branch_button.disabled = player.sim.phase == "results"
	branch_button.tooltip_text = "Select an earlier checkpoint to try another decision." if branch_button.disabled else "Create a separately paused sandbox. Original state, drafts and results stay unchanged."
	var c = player.sim
	export_scenario_button.disabled = player.sim.phase == "results"
	var lines: Array[String] = ["%s · %s · seed %d · %d laps · %s incidents" % [c.track.document.name, c.track.preset, c.seed_value, c.laps, c.intensity], "Origin: %s · event %s" % [player.record.origin, player.record.event_id.left(12)]]
	var order = c.standings()
	for id in [3, 6]:
		var car = c.cars[id]
		lines.append("%s · P%d · %d laps · %s · %d pit stops · %s" % [car.short, order.find(car)+1, car.completed, car.set_id, car.pit_stops, car.route])
	if c.phase == "results": lines.append("Saved finish. Choose an earlier checkpoint to experiment.")
	if not player.record.incomplete.is_empty(): lines.append(player.record.incomplete)
	var brief = player.record.parent.get("scenario", {})
	if not brief.is_empty(): lines.append(brief.title + " · " + ScenarioBrief.GOALS[brief.goal])
	summary.text = "\n".join(lines)
	canvas.queue_redraw(); canvas.overlay.queue_redraw()

func start_sandbox() -> void:
	if sandbox_view != null or player.sim.phase == "results": return
	playing = false
	var sim = player.branch()
	if sim == null: last_error = "Could not reconstruct the experiment."; refresh(); return
	var parent = player.lineage()
	if player.record.parent.has("scenario"): parent.scenario = player.record.parent.scenario.duplicate(true)
	var record = RaceRecord.new(); record.attach(sim, "sandbox", parent)
	mount_sandbox(sim, record)

func mount_sandbox(sim: PracticeRaceSim, record: RaceRecord) -> void:
	playing = false; sandbox_record = record; viewer.hide()
	sandbox_shell = UI.vbox(self, true)
	if record.parent.has("scenario"):
		var brief = record.parent.scenario
		var row = UI.hbox(sandbox_shell)
		scenario_details_button = UI.button("Scenario brief", func(): sandbox_view.show_reading("Authored scenario · no forced result", ScenarioBrief.describe(brief), scenario_details_button))
		row.add_child(scenario_details_button)
		scenario_status = UI.paragraph(ScenarioBrief.assessment(brief, sim)); row.add_child(scenario_status)
		PitwallDesign.scale_controls(row, float(App.settings.pitwall_text_scale))
	mode_title.text = "SANDBOX · SEPARATE SAVE"
	sandbox_return = UI.button("Return to replay", leave_sandbox); return_button.get_parent().add_child(sandbox_return)
	PitwallDesign.scale_controls(sandbox_return, float(App.settings.pitwall_text_scale))
	sandbox_view = RaceDirectorWorkspace.new(); sandbox_view.director_enabled = App.settings.get("pitwall_layout", "director") != "engineering"; sandbox_view.configure(sim); sandbox_view.recording = record
	sandbox_shell.add_child(sandbox_view)
	sandbox_view.menu_requested.connect(leave_sandbox); sandbox_view.new_weekend_requested.connect(leave_sandbox)
	sandbox_view.replay_requested.connect(func(): sandbox_view.show_reading("Sandbox recording", "Return to replay to inspect the source. Save this experiment in its separate slot; Resume sandbox opens it from the main menu.", sandbox_view.weekend_menu))
	sandbox_view.guide.hide()
	sandbox_view.set_meta("sandbox_view", true)

func save_sandbox() -> String:
	return "" if sandbox_record == null else ReplayStorage.save_session(App.sandbox_path, sandbox_record)

func leave_sandbox() -> void:
	if sandbox_view == null: return
	sandbox_view.confirm_leave(_leave_sandbox_saved)

func _leave_sandbox_saved() -> void:
	var error = save_sandbox()
	if not error.is_empty(): UI.notify(self, "Experiment not saved", error); return
	sandbox_shell.process_mode = Node.PROCESS_MODE_DISABLED
	remove_child(sandbox_shell); sandbox_shell.queue_free(); sandbox_shell = null; sandbox_view = null; sandbox_record = null
	scenario_status = null
	sandbox_return.queue_free(); sandbox_return = null; mode_title.text = "REPLAY · NOT LIVE"
	viewer.show(); refresh(); PitwallDesign.focus_later(branch_button)

func request_close() -> void:
	if sandbox_view != null: sandbox_view.confirm_leave(_close_saved)
	else: close_requested.emit()

func _close_saved() -> void:
	var error = save_sandbox()
	if not error.is_empty(): UI.notify(self, "Experiment not saved", error); return
	close_requested.emit()

func export_scenario() -> void:
	if is_instance_valid(author) or player.sim.phase == "results": return
	playing = false; refresh()
	var sim = player.branch()
	if sim == null: return
	author = ScenarioAuthor.new(); add_child(author)
	author.scenario_ready.connect(func(data):
		scenario_draft = data.brief.duplicate(true)
		export_data(data, "decision.scenario.json"))
	author.canceled.connect(func(): PitwallDesign.focus_later(export_scenario_button))
	author.configure(sim, player.lineage(), scenario_draft if not scenario_draft.is_empty() else player.record.parent.get("scenario", {}))

func export_data(data: Dictionary, filename: String) -> void:
	var dialog = FileDialog.new(); dialog.title = "Export local race evidence"; dialog.file_mode = FileDialog.FILE_MODE_SAVE_FILE
	dialog.access = FileDialog.ACCESS_FILESYSTEM; dialog.filters = PackedStringArray(["*.json ; Race recording / scenario"]); dialog.current_file = filename
	add_child(dialog)
	dialog.file_selected.connect(func(path):
		var error = Storage.write_json(path, data)
		UI.notify(self, "Export recording", "Saved independent evidence. No result was accepted." if error.is_empty() else error)
		dialog.queue_free())
	dialog.canceled.connect(dialog.queue_free); PitwallDesign.scale_controls(dialog, float(App.settings.pitwall_text_scale)); dialog.popup_centered(Vector2i(800,520))

func _unhandled_key_input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo or sandbox_view != null: return
	for window in get_viewport().get_embedded_subwindows():
		if window.visible: return
	if event.keycode == KEY_ESCAPE:
		request_close(); get_viewport().set_input_as_handled()
