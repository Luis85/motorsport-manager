class_name RaceDirectorWorkspace
extends PracticeWeekendView
## Track-first default over the same sporting model and the same expert workspaces.
## Reading is observational. Only explicitly labelled pause/watch actions alter time.
var director_enabled = true
var director_ready = false
var director: RaceMomentDirector
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
	director = RaceMomentDirector.new(); director.configure(sim)
	director.moment_reached.connect(func(_moment): refresh())
	director_navigation = UI.hbox(self); move_child(director_navigation,navigation.get_index()+1)
	live_button = DirectorStyle.button("Pit wall", close_detail, true); director_navigation.add_child(live_button)
	director_navigation.add_child(DirectorStyle.button("Race plan", func(): director_plan(own_selection())))
	director_navigation.add_child(DirectorStyle.button("Garage", func(): open_topic(4)))
	director_navigation.add_child(DirectorStyle.button("Review", open_session_workspace))
	var space = Control.new(); space.size_flags_horizontal = Control.SIZE_EXPAND_FILL; director_navigation.add_child(space)
	history_button = DirectorStyle.button("Check-ins", show_moments); director_navigation.add_child(history_button)
	tools_button = DirectorStyle.button("All tools · Ctrl+K", show_navigator); director_navigation.add_child(tools_button)
	director_strip = DirectorStyle.panel(10); add_child(director_strip); move_child(director_strip,director_navigation.get_index()+1)
	var strip_row = UI.hbox(director_strip)
	var story = UI.vbox(strip_row,true); story.add_theme_constant_override("separation",3)
	chapter_label = DirectorStyle.label("RACE DIRECTOR",11,DirectorStyle.ACCENT); story.add_child(chapter_label)
	moment_title = DirectorStyle.label("",20); moment_title.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS; story.add_child(moment_title)
	moment_detail = DirectorStyle.paragraph(); moment_detail.max_lines_visible = 2; moment_detail.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS; story.add_child(moment_detail)
	var pace_box = UI.vbox(strip_row)
	run_button = DirectorStyle.button("Next moment · 8×", toggle_watch, true); pace_box.add_child(run_button)
	run_button.custom_minimum_size.x = 188
	run_button.tooltip_text = "Explicitly run at 8x until a watched change or three lap-distances (at most 180 simulated seconds). Then pause and restore your speed. No jump, pit call or future knowledge. Manual speed cancels the watch."
	var caption = DirectorStyle.label("Real racing. Bounded check-in.",11,DirectorStyle.MUTED); pace_box.add_child(caption)
	director_cards = UI.hbox(self); move_child(director_cards,decision_bar.get_index()+1)
	for id in [3,6]:
		var card = DirectorCarCard.new(); card.driver_id = id; director_cards.add_child(card); driver_cards[id] = card
		card.call_requested.connect(open_call)
		card.plan_requested.connect(director_plan)
		card.follow_requested.connect(func(driver_id): select_driver(driver_id); set_follow(true))
	call_room = RaceCallRoom.new(); call_room.configure(sim); add_child(call_room); move_child(call_room,race_workspace.get_index()+1); call_room.hide()
	call_room.close_requested.connect(close_detail)
	call_room.command_requested.connect(_call_command)
	call_room.watch_requested.connect(watch_call)
	call_room.details_requested.connect(director_plan)
	director_feed = DirectorStyle.label("",12,DirectorStyle.MUTED); director_feed.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	director_feed.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS; map_controls.add_child(director_feed)
	director_footer = DirectorStyle.label("",11,DirectorStyle.MUTED); add_child(director_footer)
	weekend_menu.get_popup().add_separator()
	weekend_menu.get_popup().add_item("Switch pit-wall layout",30)
	weekend_menu.get_popup().id_pressed.connect(func(id):
		if id == 30:
			set_director_enabled(not director_enabled)
			App.settings.pitwall_layout = "director" if director_enabled else "engineering"
			var error = App.save_settings()
			if not error.is_empty(): feedback("Layout changed for this view; preference not saved: " + error))
	for node in [director_navigation,director_strip,director_cards,call_room,director_footer,director_feed]: PitwallDesign.scale_controls(node,text_scale)
	# Separate saved tutorial progress: the original engineering walkthrough stays intact.
	engineering_guide = guide.steps.duplicate(true)
	director_guide = engineering_guide.duplicate(true)
	director_guide.insert(0,{"title":"Watch, decide, follow the consequence", "body":"Next moment is an explicit 8x watch, not a jump: it pauses at an observed change or a bounded check-in. Pause & decide freezes a named driver's situation. Choose a call, confirm, then follow its execution. Race plan and All tools keep the full engineering controls available.", "target":func():return director_strip, "reveal":func():close_detail()})
	director_guide[1].target = func(): return director_cards
	director_guide[2].body = "The header always keeps pause, speed and the next stage approval available. Ordinary navigation never pauses. Pause & decide is explicitly different: it pauses before showing a driver's snapshot. Next moment temporarily uses 8x, then pauses and restores your prior speed. A manual speed choice ends that watch."
	director_ready = true
	set_director_enabled(director_enabled)
	refresh()

func _draw() -> void:
	if director_ready and director_enabled:
		draw_rect(Rect2(Vector2.ZERO,size), DirectorStyle.BACKGROUND if full_workspace == null or full_workspace == call_room else UI.BG)

func own_selection() -> int:
	return sim.selected_id if sim.selected_id in [3,6] else 3

func set_director_enabled(value: bool) -> void:
	director_enabled = value
	if not director_ready: return
	if not value and director.armed: director.stop("Watch stopped", "Switching layout ended the temporary watch; your prior speed is restored.")
	if full_workspace == call_room: close_detail()
	guide.hide(); guide.target = null
	guide.configure("race director" if value else "pit wall", director_guide if value else engineering_guide)
	for key in ["font_color", "font_hover_color", "font_pressed_color", "font_hover_pressed_color", "font_focus_color"]:
		if value: follow_control.add_theme_color_override(key, DirectorStyle.TEXT)
		else: follow_control.remove_theme_color_override(key)
	navigation.visible = not value
	director_navigation.visible = value
	race_read_button.show(); race_read_button.text = "Race story" if value else "Race read"
	director_feed.visible = value
	canvas.fit_padding = Vector2(50,50) if value else Vector2(90,110)
	if canvas.fit_view_enabled: canvas.call_deferred("fit")
	radio_label.get_parent().visible = not value
	director_footer.visible = value
	refresh(); adapt_layout(); queue_redraw()

func adapt_layout() -> void:
	super.adapt_layout()
	if not director_ready: return
	var full = is_instance_valid(full_workspace) and full_workspace.visible
	if director_enabled:
		navigation.hide(); decision_queue.hide(); team_summary_label.hide(); driver_rail.hide(); decision_bar.hide()
		qualifying_workspace.hide()
		director_strip.visible = not full
		director_cards.visible = not full
		if not full:
			right_panel.hide(); timing_panel.show(); race_workspace.show()
			timing_panel.custom_minimum_size.x = ceilf(PitwallDesign.TIMING_WIDTH * text_scale)
		else: race_workspace.hide()
		director_navigation.show()
		director_footer.visible = size.y > 780 or full
		var bg = DirectorStyle.BACKGROUND if not full or full_workspace == call_room else UI.BG
		if bg != cached_background: cached_background = bg; queue_redraw()
	else:
		director_strip.hide(); director_cards.hide(); director_navigation.hide()
		timing_panel.custom_minimum_size.x = ceilf(PitwallDesign.TIMING_WIDTH * text_scale)

func refresh_navigation() -> void:
	super.refresh_navigation()
	if director_ready and director_enabled: adapt_layout()

func open_topic(index: int) -> void:
	super.open_topic(index)
	if director_ready and director_enabled and full_workspace != analysis_workspace: open_analysis_workspace()

func open_practice(id: int) -> void:
	if not director_ready or not director_enabled:
		super.open_practice(id); return
	if id not in [3,6]: return
	select_driver(id); practice_panel.choose_driver(id)
	open_practice_workspace()
	PitwallDesign.focus_later(practice_workspace.panels[id].objective_buttons.tyre_life)

func show_navigator() -> void:
	if not director_ready or not director_enabled:
		super.show_navigator(); return
	if navigator.visible: return
	var focus = get_viewport().gui_get_focus_owner()
	navigator.show_picker(focus if is_instance_valid(focus) and focus.is_visible_in_tree() else tools_button)

func open_destination(index: int, subtopic: int) -> void:
	if director_ready and director_enabled:
		# These readers need a visible return target, not the hidden engineering Find.
		if duel_workspace != null and index == duel_workspace.index and subtopic == 1:
			show_reading("Tactical evidence", TacticalDuels.debrief(sim), tools_button); return
		if index == 7 and subtopic == 21:
			NotebookWindow.open(self, recording, CircuitNotebook.PATH, tools_button); return
		if index == practice_page_index:
			open_practice(own_selection()); return
	super.open_destination(index, subtopic)
	if director_ready and director_enabled and full_workspace == analysis_workspace and analysis_workspace.visible:
		PitwallDesign.focus_later(analysis_workspace.drivers[own_selection()])

func close_session_workspace() -> void:
	var closing_call = full_workspace == call_room and call_room != null
	var id = int(call_room.snapshot.get("driver_id",3)) if closing_call else own_selection()
	var was_open = is_instance_valid(full_workspace) and full_workspace.visible
	super.close_session_workspace()
	if director_ready and director_enabled:
		right_panel.hide(); adapt_layout()
		if was_open:
			var target = driver_cards[id].call_button if closing_call else (full_invoker if is_instance_valid(full_invoker) and full_invoker.is_visible_in_tree() else live_button)
			PitwallDesign.focus_later(target)

func close_detail() -> void:
	var closing_call = full_workspace == call_room and call_room != null
	var id = int(call_room.snapshot.get("driver_id",3)) if closing_call else own_selection()
	super.close_detail()
	if director_ready and director_enabled:
		adapt_layout()
		PitwallDesign.focus_later(driver_cards[id].call_button if closing_call else live_button)

func director_plan(id: int) -> void:
	if id not in [3,6]: return
	select_driver(id); open_topic(6); strategy_desk.show_topic(1); refresh_navigation()

func open_call(id: int) -> void:
	if id not in [3,6]: return
	if sim.phase in ["results","qualifying_results"] or sim.cars[id].dnf or sim.cars[id].finished:
		open_results_workspace(); return
	if sim.phase in ["practice","practice_results"]: open_practice(id); return
	if sim.phase not in ["race","qualifying"]: director_plan(id); return
	# This is the explicitly labelled Pause & decide action, never ordinary navigation.
	if director.armed or not sim.paused: director.stop("Decision time", "Paused explicitly to review " + sim.cars[id].name + ".",id)
	var invoker = driver_cards[id].call_button
	close_session_workspace(); full_invoker = invoker
	select_driver(id)
	full_workspace = call_room
	call_room.show()
	var value = RaceDecisionViewModel.capture(strategy_model,id,strategy_model.forecast(id))
	call_room.present(value,call_receipts.get(id,{}))
	adapt_layout(); refresh()

func _call_command(action: String, payload: Dictionary) -> void:
	var accepted = strategy_model.command(action,payload)
	call_room.command_result(accepted,strategy_model.last_error,action,payload)
	if accepted: call_receipts[int(payload.id)] = call_room.receipt
	feedback(("Accepted · " if accepted else "Not sent · ") + sim.cars[int(payload.id)].short + " · " + (action.replace("_"," ") if accepted else strategy_model.last_error))
	forecast_cache.clear(); refresh()

func watch_call() -> void:
	var id = int(call_room.snapshot.get("driver_id",own_selection()))
	close_detail()
	if not director.start(id): feedback("There is no active session to watch. Approve the next stage when ready.")
	refresh()
	PitwallDesign.focus_later(run_button)

func toggle_watch() -> void:
	if director.armed: director.stop()
	else: director.start(own_selection())
	refresh()

func refresh() -> void:
	super.refresh()
	if not director_ready or not director_enabled: return
	for id in [3,6]:
		# A qualifying receipt must not replace the new race's command surface.
		# The historical command remains in the authoritative journal and replay.
		if call_receipts.has(id) and call_receipts[id].snapshot.phase != sim.phase:
			call_receipts.erase(id)
		var progress: Dictionary = {}
		if call_receipts.has(id):
			var receipt: Dictionary = call_receipts[id]
			progress = RaceDecisionViewModel.receipt_progress(strategy_model,receipt)
			if progress.terminal: receipt.outcome = progress
			else:
				receipt.record_offset = strategy_model.strategy_state.records.size()
				if progress.has("entry_id"): receipt.entry_id = progress.entry_id
				if progress.has("recalled"): receipt.recalled = progress.recalled
		driver_cards[id].present(DirectorReadModel.car(strategy_model,id,forecast_cache.get(id,{})),sim.phase,sim.paused,progress)
	var story = DirectorReadModel.spotlight(strategy_model,forecast_cache)
	chapter_label.text = story.eyebrow
	moment_title.text = story.title
	moment_detail.text = story.detail
	if director.armed:
		chapter_label.text = "WATCHING / 8× / NO SKIPPED STEPS"
		moment_title.text = "The next call is coming into view."
		moment_detail.text = "Watching both cars, pit execution, resources, flags and observed conditions. Pause anytime; your previous speed returns at the check-in."
	elif sim.paused and not director.last_moment.is_empty():
		chapter_label.text = "LAST CHECK-IN / %.1fs" % director.last_moment.time
		moment_title.text = director.last_moment.title
		moment_detail.text = director.last_moment.detail
	moment_title.tooltip_text = moment_title.text
	moment_detail.tooltip_text = moment_detail.text
	run_button.text = "Stop & pause" if director.armed else "Next moment · 8×"
	run_button.disabled = sim.phase not in RaceSim.ACTIVE
	history_button.text = "Check-ins" if director.history.is_empty() else "Check-ins (%d)" % director.history.size()
	director_footer.text = "SPACE pause / resume   ·   1–5 speed   ·   F fit   ·   Ctrl+K all tools   |   %s" % ("SANDBOX · not the original result" if recording != null and recording.origin == "sandbox" else "Race Director · Weekend menu switches layout")
	if Time.get_ticks_msec() / 1000.0 < feedback_until: director_footer.text = radio_label.text
	director_feed.text = ""
	if not sim.events.is_empty():
		var event = sim.events.back()
		director_feed.text = "%.0fs · %s" % [event.time,event.text]
		if Time.get_ticks_msec() / 1000.0 < feedback_until: director_feed.text = radio_label.text
		director_feed.tooltip_text = director_feed.text + "\nRead the full radio and race story through All tools."
	if call_room.visible: call_room.refresh_state()
	adapt_layout()

func show_moments() -> void:
	var lines: Array[String] = ["OBSERVED CHECK-INS · current view only. This is not the complete race journal.\nNo stops, outcomes or benefits are invented. A check-in never chooses a car command."]
	if director.history_dropped > 0: lines.append("Latest 24 check-ins retained; %d older entries are no longer in this view. Full race evidence remains separate." % director.history_dropped)
	for i in range(director.history.size()-1,-1,-1):
		var moment = director.history[i]
		lines.append("%.1fs · %s\n%s" % [moment.time,moment.title,moment.detail])
	if director.history.is_empty(): lines.append("No check-ins yet. Start an active session, then choose Next moment to watch real racing.")
	show_reading("Race Director / check-ins", "\n\n".join(lines), history_button)

func confirm_leave(proceed: Callable) -> void:
	super.confirm_leave(func():
		if director != null and director.armed: director.stop("Watch stopped", "Leaving the pit wall restores your previous speed before saving.")
		proceed.call())

func _exit_tree() -> void:
	if director != null: director.detach()
