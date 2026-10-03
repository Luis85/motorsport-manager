class_name RaceDirectorWorkspace
extends PracticeWeekendView
## Track-first default over the same sporting model and the same expert workspaces.
## Reading is observational. Only explicitly labelled pause/watch actions alter time.
var director_enabled = true
var director_ready = false
var director: RaceMomentControl
var director_navigation: HBoxContainer
var director_strip: PanelContainer
var director_cards: HBoxContainer
var driver_cards: Dictionary = {}
var chapter_label: Label
var moment_title: Label
var moment_detail: Label
var run_button: Button
var history_button: Button
var live_button: Button
var tools_button: Button
var director_footer: Label
var director_feed: Label
var call_room: RaceCallRoom
var call_receipts: Dictionary = {}
var cached_background = Color.TRANSPARENT
var engineering_guide: Array = []
var director_guide: Array = []


func _ready() -> void:
	super._ready()
	RaceDirectorPresentation._ready(self)


func _draw() -> void:
	if director_ready and director_enabled:
		draw_rect(
			Rect2(Vector2.ZERO, size),
			(
				DirectorStyle.BACKGROUND
				if full_workspace == null or full_workspace == call_room
				else UI.BG
			)
		)


func own_selection() -> int:
	return sim.selected_id if sim.selected_id in sim.player_ids() else sim.player_ids()[0]


func set_director_enabled(value: bool) -> void:
	director_enabled = value
	if not director_ready:
		return
	if not value and director.armed:
		director.stop(
			"Watch stopped",
			"Switching layout ended the temporary watch; your prior speed is restored."
		)
	if full_workspace == call_room:
		close_detail()
	guide.hide()
	guide.target = null
	guide.configure(
		"race director" if value else "pit wall", director_guide if value else engineering_guide
	)
	for key in [
		"font_color",
		"font_hover_color",
		"font_pressed_color",
		"font_hover_pressed_color",
		"font_focus_color"
	]:
		if value:
			follow_control.add_theme_color_override(key, DirectorStyle.TEXT)
		else:
			follow_control.remove_theme_color_override(key)
	navigation.visible = not value
	director_navigation.visible = value
	race_read_button.show()
	race_read_button.text = "Race story" if value else "Race read"
	director_feed.visible = value
	canvas.fit_padding = Vector2(50, 50) if value else Vector2(90, 110)
	if canvas.fit_view_enabled:
		canvas.call_deferred("fit")
	radio_label.get_parent().visible = not value
	director_footer.visible = value
	refresh()
	adapt_layout()
	queue_redraw()


func adapt_layout() -> void:
	super.adapt_layout()
	if not director_ready:
		return
	var full = is_instance_valid(full_workspace) and full_workspace.visible
	if director_enabled:
		navigation.hide()
		decision_queue.hide()
		team_summary_label.hide()
		driver_rail.hide()
		decision_bar.hide()
		qualifying_workspace.hide()
		director_strip.visible = not full
		director_cards.visible = not full
		if not full:
			right_panel.hide()
			timing_panel.show()
			race_workspace.show()
			timing_panel.custom_minimum_size.x = ceilf(PitwallDesign.TIMING_WIDTH * text_scale)
		else:
			race_workspace.hide()
		director_navigation.show()
		director_footer.visible = size.y > 780 or full
		var bg = DirectorStyle.BACKGROUND if not full or full_workspace == call_room else UI.BG
		if bg != cached_background:
			cached_background = bg
			queue_redraw()
	else:
		director_strip.hide()
		director_cards.hide()
		director_navigation.hide()
		timing_panel.custom_minimum_size.x = ceilf(PitwallDesign.TIMING_WIDTH * text_scale)


func refresh_navigation() -> void:
	super.refresh_navigation()
	if director_ready and director_enabled:
		adapt_layout()


func open_topic(index: int) -> void:
	super.open_topic(index)
	if director_ready and director_enabled and full_workspace != analysis_workspace:
		open_analysis_workspace()


func open_practice(id: int) -> void:
	if not director_ready or not director_enabled:
		super.open_practice(id)
		return
	if id not in sim.player_ids():
		return
	select_driver(id)
	practice_panel.choose_driver(id)
	open_practice_workspace()
	PitwallDesign.focus_later(practice_workspace.panels[id].objective_buttons.tyre_life)


func show_navigator() -> void:
	if not director_ready or not director_enabled:
		super.show_navigator()
		return
	if navigator.visible:
		return
	var focus = get_viewport().gui_get_focus_owner()
	navigator.show_picker(
		focus if is_instance_valid(focus) and focus.is_visible_in_tree() else tools_button
	)


func open_destination(index: int, subtopic: int) -> void:
	if director_ready and director_enabled:
		# These readers need a visible return target, not the hidden engineering Find.
		if duel_workspace != null and index == duel_workspace.index and subtopic == 1:
			show_reading("Tactical evidence", sim.tactical_debrief(), tools_button)
			return
		if index == 7 and subtopic == 21:
			NotebookWindow.open(self, recording, NotebookPort.PATH, tools_button)
			return
		if index == practice_page_index:
			open_practice(own_selection())
			return
	super.open_destination(index, subtopic)
	if (
		director_ready
		and director_enabled
		and full_workspace == analysis_workspace
		and analysis_workspace.visible
	):
		PitwallDesign.focus_later(analysis_workspace.drivers[own_selection()])


func close_session_workspace() -> void:
	var closing_call = full_workspace == call_room and call_room != null
	var id = (
		int(call_room.snapshot.get("driver_id", sim.player_ids()[0]))
		if closing_call
		else own_selection()
	)
	var was_open = is_instance_valid(full_workspace) and full_workspace.visible
	super.close_session_workspace()
	if director_ready and director_enabled:
		right_panel.hide()
		adapt_layout()
		if was_open:
			var target = (
				driver_cards[id].call_button
				if closing_call
				else (
					full_invoker
					if is_instance_valid(full_invoker) and full_invoker.is_visible_in_tree()
					else live_button
				)
			)
			PitwallDesign.focus_later(target)


func close_detail() -> void:
	var closing_call = full_workspace == call_room and call_room != null
	var id = (
		int(call_room.snapshot.get("driver_id", sim.player_ids()[0]))
		if closing_call
		else own_selection()
	)
	super.close_detail()
	if director_ready and director_enabled:
		adapt_layout()
		PitwallDesign.focus_later(driver_cards[id].call_button if closing_call else live_button)


func director_plan(id: int) -> void:
	if id not in sim.player_ids():
		return
	select_driver(id)
	open_topic(6)
	strategy_desk.show_topic(1)
	refresh_navigation()


func open_call(id: int) -> void:
	if id not in sim.player_ids():
		return
	if sim.phase in ["results", "qualifying_results"] or sim.car(id).dnf or sim.car(id).finished:
		open_results_workspace()
		return
	if sim.phase in ["practice", "practice_results"]:
		open_practice(id)
		return
	if sim.phase not in ["race", "qualifying"]:
		director_plan(id)
		return
	# This is the explicitly labelled Pause & decide action, never ordinary navigation.
	if director.armed or not sim.paused:
		director.stop("Decision time", "Paused explicitly to review " + sim.car(id).name + ".", id)
	var invoker = driver_cards[id].call_button
	close_session_workspace()
	full_invoker = invoker
	select_driver(id)
	full_workspace = call_room
	call_room.show()
	var value = strategy_model.race_decision_view_model_capture(id, strategy_model.forecast(id))
	call_room.present(value, call_receipts.get(id, {}))
	adapt_layout()
	refresh()


func _call_command(action: String, payload: Dictionary) -> void:
	var accepted = commands.execute(action, payload)
	call_room.command_result(accepted, strategy_model.last_error, action, payload)
	if accepted:
		call_receipts[int(payload.id)] = call_room.receipt
	feedback(
		(
			("Accepted · " if accepted else "Not sent · ")
			+ sim.car(int(payload.id)).short
			+ " · "
			+ (action.replace("_", " ") if accepted else strategy_model.last_error)
		)
	)
	forecast_cache.clear()
	refresh()


func watch_call() -> void:
	var id = int(call_room.snapshot.get("driver_id", own_selection()))
	close_detail()
	if not director.start(id):
		feedback("There is no active session to watch. Approve the next stage when ready.")
	refresh()
	PitwallDesign.focus_later(run_button)


func toggle_watch() -> void:
	if director.armed:
		director.stop()
	else:
		director.start(own_selection())
	refresh()


func refresh() -> void:
	super.refresh()
	if not director_ready or not director_enabled:
		return
	for id in sim.player_ids():
		# A qualifying receipt must not replace the new race's command surface.
		# The historical command remains in the authoritative journal and replay.
		if call_receipts.has(id) and call_receipts[id].snapshot.phase != sim.phase:
			call_receipts.erase(id)
		var progress: Dictionary = {}
		if call_receipts.has(id):
			var receipt: Dictionary = call_receipts[id]
			progress = strategy_model.race_decision_view_model_receipt_progress(receipt)
			if progress.terminal:
				receipt.outcome = progress
			else:
				receipt.record_offset = strategy_model.strategy_state.records.size()
				if progress.has("entry_id"):
					receipt.entry_id = progress.entry_id
				if progress.has("recalled"):
					receipt.recalled = progress.recalled
		driver_cards[id].present(
			strategy_model.director_read_model_car(id, forecast_cache.get(id, {})),
			sim.phase,
			sim.paused,
			progress
		)
	var story = strategy_model.director_read_model_spotlight(forecast_cache)
	chapter_label.text = story.eyebrow
	moment_title.text = story.title
	moment_detail.text = story.detail
	if director.armed:
		chapter_label.text = "WATCHING / 8× / NO SKIPPED STEPS"
		moment_title.text = "The next call is coming into view."
		moment_detail.text = (
			"Watching both cars, pit execution, resources, flags and observed conditions. "
			+ "Pause anytime; your previous speed returns at the check-in."
		)
	elif sim.paused and not director.last_moment.is_empty():
		chapter_label.text = "LAST CHECK-IN / %.1fs" % director.last_moment.time
		moment_title.text = director.last_moment.title
		moment_detail.text = director.last_moment.detail
	moment_title.tooltip_text = moment_title.text
	moment_detail.tooltip_text = moment_detail.text
	run_button.text = "Stop & pause" if director.armed else "Next moment · 8×"
	run_button.disabled = sim.phase not in RaceViewQuery.ACTIVE
	history_button.text = (
		"Check-ins" if director.history.is_empty() else "Check-ins (%d)" % director.history.size()
	)
	director_footer.text = (
		"SPACE pause / resume   ·   1–5 speed   ·   F fit   ·   Ctrl+K all tools   |   %s"
		% (
			"SANDBOX · not the original result"
			if recording != null and recording.origin == "sandbox"
			else "Race Director · Weekend menu switches layout"
		)
	)
	if Time.get_ticks_msec() / 1000.0 < feedback_until:
		director_footer.text = radio_label.text
	director_feed.text = ""
	if not sim.events.is_empty():
		var event = sim.events.back()
		director_feed.text = "%.0fs · %s" % [event.time, event.text]
		if Time.get_ticks_msec() / 1000.0 < feedback_until:
			director_feed.text = radio_label.text
		director_feed.tooltip_text = (
			director_feed.text + "\nRead the full radio and race story through All tools."
		)
	if call_room.visible:
		call_room.refresh_state()
	adapt_layout()


func show_moments() -> void:
	RaceDirectorPresentation.show_moments(self)


func confirm_leave(proceed: Callable) -> void:
	super.confirm_leave(
		func():
			if director != null and director.armed:
				director.stop(
					"Watch stopped",
					"Leaving the pit wall restores your previous speed before saving."
				)
			proceed.call()
	)


func _exit_tree() -> void:
	if director != null:
		director.detach()
