class_name RaceCallRoom
extends VBoxContainer
## A named-driver, frozen decision. Choosing is not committing. No forecasts mutate here.
signal close_requested
signal command_requested(action: String, payload: Dictionary)
signal watch_requested
signal details_requested(id: int)
var model: PracticeRaceSim
var snapshot: Dictionary = {}
var selected = ""
var submitted = false
var receipt: Dictionary = {}
var heading: Label
var context: Label
var evidence: Label
var source_label: Label
var stage_label: Label
var message: Label
var options: GridContainer
var option_buttons: Dictionary = {}
var confirm_button: Button
var keep_button: Button
var refresh_button: Button
var watch_button: Button
var back_button: Button
var details_button: Button
var scroll: ScrollContainer
var footer: VBoxContainer
var submit_sequence = 0
var outcome_panel: PanelContainer
var outcome_title: Label
var outcome_metrics: Label
var outcome_detail: Label

func configure(value: PracticeRaceSim) -> void:
	model = value

func _ready() -> void:
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	add_theme_constant_override("separation", 8)
	var top = UI.hbox(self)
	back_button = DirectorStyle.button("Back to pit wall", func(): close_requested.emit()); top.add_child(back_button)
	heading = DirectorStyle.label("Make a call", 22); heading.size_flags_horizontal = Control.SIZE_EXPAND_FILL; top.add_child(heading)
	stage_label = DirectorStyle.label("REVIEW", 13, DirectorStyle.ACCENT); top.add_child(stage_label)
	scroll = ScrollContainer.new(); scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED; scroll.follow_focus = true; add_child(scroll)
	var body = UI.vbox(scroll, true)
	var facts_panel = DirectorStyle.panel(); body.add_child(facts_panel); var facts_body = UI.vbox(facts_panel)
	context = DirectorStyle.label("", 16); facts_body.add_child(context)
	evidence = DirectorStyle.paragraph(); facts_body.add_child(evidence)
	source_label = DirectorStyle.paragraph(); facts_body.add_child(source_label)
	options = GridContainer.new(); options.columns = 2; body.add_child(options)
	options.add_theme_constant_override("h_separation", 10); options.add_theme_constant_override("v_separation", 10)
	for key in ["push", "protect", "fuel", "pit", "send", "recall"]:
		var button = DirectorStyle.button("", func(): choose(key))
		button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.custom_minimum_size = Vector2(0, 92)
		options.add_child(button); option_buttons[key] = button
	outcome_panel = DirectorStyle.panel(); body.add_child(outcome_panel)
	var followup = UI.vbox(outcome_panel)
	outcome_title = DirectorStyle.label("", 20, DirectorStyle.ACCENT); followup.add_child(outcome_title)
	outcome_metrics = DirectorStyle.paragraph("", DirectorStyle.TEXT); followup.add_child(outcome_metrics)
	outcome_detail = DirectorStyle.paragraph(); followup.add_child(outcome_detail)
	followup.add_child(DirectorStyle.paragraph("These are observations since the call, not proof of its effect. Traffic, conditions and other orders also influence the result."))
	var limits = DirectorStyle.paragraph("No guaranteed pass or finishing position. A radio call changes one channel for two lap-distances, then returns control. It does not change your pit orders or racecraft.")
	body.add_child(limits)
	var utilities = UI.hbox(body)
	refresh_button = DirectorStyle.button("Refresh situation", refresh_snapshot); utilities.add_child(refresh_button)
	details_button = DirectorStyle.button("Full strategy & ownership", func(): details_requested.emit(int(snapshot.get("driver_id",3)))); utilities.add_child(details_button)
	var spacer = Control.new(); spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL; body.add_child(spacer)
	var footer_panel = DirectorStyle.panel(); add_child(footer_panel); footer = UI.vbox(footer_panel)
	message = DirectorStyle.paragraph("Choose an option, then confirm the named driver.", DirectorStyle.TEXT); footer.add_child(message)
	var actions = UI.hbox(footer)
	confirm_button = DirectorStyle.button("Choose a call above", commit, true); confirm_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL; actions.add_child(confirm_button)
	keep_button = DirectorStyle.button("Keep orders & watch", func(): watch_requested.emit()); actions.add_child(keep_button)
	keep_button.tooltip_text = "No car command. Existing owners and queued stops stay valid. Run at 8x until the next watched change or bounded check-in."
	watch_button = DirectorStyle.button("Watch it unfold · 8×", func(): watch_requested.emit(), true); watch_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL; actions.add_child(watch_button); watch_button.hide()
	PitwallDesign.linear_focus([back_button] + option_buttons.values() + [refresh_button, details_button, confirm_button, keep_button])

func present(value: Dictionary = {}, accepted: Dictionary = {}) -> void:
	if value.is_empty(): refresh_state(); return
	snapshot = accepted.snapshot.duplicate(true) if not accepted.is_empty() else value.duplicate(true); receipt = accepted
	selected = ""; submitted = false
	heading.text = snapshot.name + " / make the call"
	context.text = "P%d   ·   %s / %.0f%% tread   ·   finish fuel ~%+.1f laps" % [snapshot.position,snapshot.set_id,snapshot.tyre,snapshot.fuel_margin]
	evidence.text = snapshot.primary.get("evidence", "No urgent issue. An unchanged plan is a valid decision.")
	source_label.text = "SNAPSHOT %.1fs · %s\n%s" % [snapshot.forecast.time, snapshot.phase.replace("_", " "), snapshot.ownership]
	option_buttons.push.text = "Push for 2 laps\nPace only · higher tyre demand\nNo promise of a pass"
	option_buttons.protect.text = "Protect tyres for 2 laps\nPace only · less speed, less tyre demand\nYour pit order stays unchanged"
	option_buttons.fuel.text = "Save fuel for 2 laps\nEngine only · less power, less fuel used\nPace and racecraft stay unchanged"
	var f: Dictionary = snapshot.forecast
	option_buttons.pit.text = "Box at safe entry · lap %d\nFit %s · physical service required\n~%.1f–%.1fs net loss · rejoin P%d–%d" % [f.gate.lap, f.replacement_id if not f.replacement_id.is_empty() else "no usable set", f.pit.loss_low, f.pit.loss_high,f.pit.position_low,f.pit.position_high]
	option_buttons.recall.text = "Recall this run\nReturn to the garage\nAn unfinished flying lap may be lost"
	option_buttons.send.text = "Bank a timed lap\nRelease on the planned tyre set\nOut-lap, flying lap, then in-lap"
	if snapshot.phase == "qualifying":
		context.text = "P%d   ·   %s / %.0f%% tread   ·   fuel on board %.1f laps" % [snapshot.position,snapshot.set_id,snapshot.tyre,snapshot.fuel]
		evidence.text = "Current run: %s. A new release needs approximately %.0fs to start a legal flying lap; latest release at session %.0fs." % [model.cars[int(snapshot.driver_id)].qual_state.replace("_"," "),snapshot.release.required_seconds,snapshot.release.latest_release]
	message.text = "Choose a call. Keeping orders retains the engineer and any queued pit stop; it does not cancel them."
	for button in option_buttons.values(): DirectorStyle.style_button(button)
	refresh_state()
	scroll.scroll_vertical = 0
	PitwallDesign.focus_later(back_button)

func refresh_snapshot() -> void:
	if snapshot.is_empty(): return
	var id = int(snapshot.driver_id)
	present(RaceDecisionViewModel.capture(model,id,model.forecast(id)))

func is_stale() -> bool:
	return snapshot.is_empty() or model.phase != snapshot.phase or RaceForecaster.stale(model,snapshot.forecast,int(model.policy(snapshot.driver_id).revision))

func choose(key: String) -> void:
	refresh_state()
	if not option_buttons.has(key) or option_buttons[key].disabled or not receipt.is_empty() or submitted: return
	selected = key
	for other in option_buttons: DirectorStyle.style_button(option_buttons[other], other == key)
	message.text = commitment_text()
	refresh_state()
	PitwallDesign.focus_later(confirm_button)

func commitment_text() -> String:
	if selected == "pit":
		return "%s: fit %s at safe entry lap %d. Pit ownership becomes yours; other owners stay unchanged. Estimated loss includes pit travel and service, not a guaranteed finishing time." % [snapshot.name,snapshot.forecast.replacement_id,snapshot.forecast.gate.lap]
	if selected == "recall": return "%s: recall this qualifying run. The car returns physically; an unfinished flying lap may be lost." % snapshot.name
	if selected == "send": return "%s: release the planned real set for an out/flying/in-lap run. No qualifying result is guaranteed." % snapshot.name
	var channel = "engine" if selected == "fuel" else "pace"
	return "%s: %s for two lap-distances from acceptance. Only %s changes; existing pit orders stay valid. After expiry, the previous owner/value resumes." % [snapshot.name,{"push":"push pace","protect":"protect tyres","fuel":"save fuel"}.get(selected,"keep orders"),channel]

func payload() -> Dictionary:
	if selected == "pit": return RaceDecisionViewModel.pit_payload(snapshot)
	if selected in ["send", "recall"]: return {"id":snapshot.driver_id}
	return {"id":snapshot.driver_id,"channel":"engine" if selected == "fuel" else "pace","value":2 if selected == "push" else 0,"laps":2}

func commit() -> void:
	refresh_state()
	if confirm_button.disabled: return
	submitted = true; submit_sequence = int(model.strategy_state.sequence)
	var action = "pit" if selected == "pit" else (selected if selected in ["send", "recall"] else "resource_intent")
	command_requested.emit(action, payload())

func command_result(accepted: bool, error: String, action: String, value: Dictionary) -> void:
	submitted = false
	if accepted:
		receipt = RaceDecisionViewModel.accepted_receipt(model,snapshot,action,value,submit_sequence)
	else: message.text = "Not sent: " + error + " Refresh this situation before trying again."
	refresh_state()
	PitwallDesign.focus_later(watch_button if accepted else refresh_button)

func refresh_state() -> void:
	if snapshot.is_empty() or confirm_button == null: return
	var stale = is_stale()
	var c = model.cars[int(snapshot.driver_id)]
	var locked = not receipt.is_empty() or submitted
	for key in option_buttons:
		var button: Button = option_buttons[key]
		button.visible = not locked and (snapshot.phase == "race" and key not in ["send", "recall"] or snapshot.phase == "qualifying" and key in ["send", "recall"])
		button.disabled = stale or locked or c.dnf or c.finished
		if key == "pit": button.disabled = button.disabled or c.route != "track" or c.pit_order or snapshot.forecast.replacement_id.is_empty() or snapshot.forecast.gate.distance >= model.laps * model.track.length
		if key == "recall": button.disabled = button.disabled or c.route != "track" or c.qual_state == "inlap"
		if key == "send": button.disabled = button.disabled or not RaceForecaster.qualifying_release(model,c).can_start_hotlap
		button.tooltip_text = "Refresh stale evidence before committing." if stale else ("Not available in the current car/session state." if button.disabled else "Choose for " + snapshot.name + "; confirmation is separate.")
	stage_label.text = "STALE / REFRESH" if stale and not locked else ("FOLLOW OUTCOME" if locked else "PAUSED / REVIEW" if model.paused else "LIVE / SNAPSHOT")
	confirm_button.visible = not locked
	confirm_button.disabled = stale or locked or selected.is_empty() or option_buttons[selected].disabled
	confirm_button.text = "Confirm %s · %s" % [snapshot.short, {"push":"push 2 laps","protect":"protect 2 laps","fuel":"save 2 laps","pit":"box","send":"release","recall":"recall"}.get(selected,"")] if not selected.is_empty() else "Choose a call above"
	keep_button.visible = not locked
	outcome_panel.visible = locked
	watch_button.visible = locked
	watch_button.disabled = model.phase not in RaceSim.ACTIVE
	refresh_button.text = "Review a new call" if locked else "Refresh situation"
	if locked and not receipt.is_empty():
		var progress = RaceDecisionViewModel.receipt_progress(model,receipt)
		if progress.terminal: receipt.outcome = progress
		else:
			receipt.record_offset = model.strategy_state.records.size()
			if progress.has("entry_id"): receipt.entry_id = progress.entry_id
			if progress.has("recalled"): receipt.recalled = progress.recalled
		var current = DirectorReadModel.car(model,int(snapshot.driver_id))
		outcome_title.text = "Call accepted → " + ("observed outcome" if progress.terminal else "executing")
		outcome_metrics.text = "Position P%d → P%d   |   Tread %.0f%% → %.0f%%   |   Fuel on board %.1f → %.1f laps\nElapsed since acceptance: %.1fs · %s" % [snapshot.position,current.position,snapshot.tyre,current.tyre,snapshot.fuel,c.fuel,maxf(0,model.total_time-float(receipt.accepted_at)),current.status]
		outcome_detail.text = progress.detail
		message.text = "%s · %s\n%s" % [snapshot.name,progress.label,progress.detail]
