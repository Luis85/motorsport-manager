class_name StrategyDesk
extends VBoxContainer
## All plan editing is local until Approve. Live controls name their driver explicitly.
signal command_requested(action: String, payload: Dictionary)
signal preview_changed(forecast: Dictionary)
var model: StrategyRaceSim
var driver_id = 3
var drafts: Dictionary = {}
var revisions: Dictionary = {}
var dirty: Dictionary = {}
var loading = false
var preview: Dictionary = {}
var live_preview: Dictionary = {}
var target_picker: OptionButton
var draft_status: Label
var plan_status: Label
var objective: OptionButton
var starting_set: OptionButton
var stop_count: SpinBox
var stop_rows: Array = []
var avoid_traffic: CheckButton
var emergency: CheckButton
var tyre_target: SpinBox
var fuel_target: SpinBox
var apply_button: Button
var clear_button: Button
var ownership_controls: Dictionary = {}
var override_label: Label
var estimates: Label
var rejoin: Label
var issue_text: Label
var briefing_text: Label
var box_now: Button
var extend_draft: Button
var action_buttons: Array[Button] = []
var last_refresh = -100.0
var topic = 0
var topic_panels: Array[VBoxContainer] = []
var topic_buttons: Array[Button] = []

func configure(sim: StrategyRaceSim) -> void:
	model = sim

func _ready() -> void:
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	add_theme_constant_override("separation", 6)
	target_picker = UI.option(["MER · Daniel Mercer", "MOR · Lucas Moreau"], func(index): select_driver([3, 6][index])); add_child(target_picker); target_picker.visible = false
	plan_status = UI.paragraph(""); plan_status.add_theme_font_size_override("font_size", 12); add_child(plan_status)
	var topics = UI.hbox(self)
	for title in ["Compare", "Plan", "Control"]:
		var index = topic_buttons.size()
		var button = UI.button(title, func(): show_topic(index)); button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.custom_minimum_size.y = 32; button.add_theme_font_size_override("font_size", 12); topics.add_child(button); topic_buttons.append(button); compact_button(button)
	for i in range(3): topic_panels.append(UI.vbox(self))
	var compare_panel = topic_panels[0]; var plan_panel = topic_panels[1]; var control_panel = topic_panels[2]
	var nav = HFlowContainer.new(); plan_panel.add_child(nav)
	for template in ["balanced", "alternate", "no_stop"]:
		nav.add_child(UI.button(template.replace("_", " ").capitalize(), func(): new_draft(template)))
	nav.add_child(UI.button("Discard draft / reload", func(): load_current(true)))
	draft_status = UI.paragraph(""); draft_status.add_theme_font_size_override("font_size", 12); plan_panel.add_child(draft_status)
	objective = UI.option(["Balanced result", "Protect the finish", "Chase a position"], func(_v): changed()); stack_field(plan_panel, "DRAFT OBJECTIVE", objective)
	starting_set = UI.option(["Select a set"], func(_v): changed()); stack_field(plan_panel, "STARTING SET · fitted only at formation", starting_set)
	stop_count = UI.spin(1, 0, 3, 1, func(_v): changed()); stack_field(plan_panel, "PLANNED STOP WINDOWS · zero is legal", stop_count)
	for i in range(3):
		var row = UI.vbox(plan_panel)
		row.add_child(UI.label("STOP %d · earliest / latest lap" % (i + 1), 11, UI.MUTED))
		var range_row = UI.hbox(row)
		var first = UI.spin(2 + i * 3, 1, maxi(1, model.laps - 1), 1, func(_v): changed()); range_row.add_child(first)
		var last = UI.spin(3 + i * 3, 1, maxi(1, model.laps - 1), 1, func(_v): changed()); range_row.add_child(last)
		var item = UI.option(["Select a set"], func(_v): changed()); row.add_child(item)
		stop_rows.append({"row": row, "first": first, "last": last, "set": item})
	avoid_traffic = UI.check("Avoid rejoin traffic within window", true, func(_v): changed()); plan_panel.add_child(avoid_traffic)
	emergency = UI.check("Permit emergency tyre recovery", true, func(_v): changed()); emergency.tooltip_text = "Applies only to engineer-owned pits. Manual pit ownership always stays manual."; plan_panel.add_child(emergency)
	tyre_target = UI.spin(22, 5, 50, 1, func(_v): changed()); stack_field(plan_panel, "TARGET TREAD RESERVE (%)", tyre_target)
	fuel_target = UI.spin(0.35, 0, 3, 0.05, func(_v): changed()); stack_field(plan_panel, "FUEL RESERVE (lap-equivalent units)", fuel_target)
	apply_button = UI.button("Approve plan", apply, true); plan_panel.add_child(apply_button)
	clear_button = UI.button("Clear approved plan · manual pits", func(): command_requested.emit("clear_plan", {"id": driver_id})); plan_panel.add_child(clear_button)
	plan_panel.add_child(UI.paragraph("Approval delegates only pit windows. Other owners stay unchanged. The chosen set is not fitted and no physical pit order is issued until execution."))
	control_panel.add_child(UI.label("LIVE OWNERSHIP · takes effect immediately", 12, UI.ACCENT))
	for channel in StrategyPlan.CHANNELS:
		var choice = UI.option(["Engineer", "Player"], func(index): command_requested.emit("delegation", {"id": driver_id, "channel": channel, "owner": ["engineer", "player"][index]}))
		stack_field(control_panel, channel.capitalize(), choice); ownership_controls[channel] = choice
	override_label = UI.paragraph(""); control_panel.add_child(override_label)
	var attacks = HFlowContainer.new(); control_panel.add_child(attacks)
	for entry in [["Push 2 laps", "pace", 2], ["Save tyres 2 laps", "pace", 0], ["Engine attack 2 laps", "engine", 2], ["Save fuel 2 laps", "engine", 0]]:
		var button = UI.button(entry[0], func(): command_requested.emit("resource_intent", {"id": driver_id, "channel": entry[1], "value": entry[2], "laps": 2}))
		attacks.add_child(button); action_buttons.append(button)
	briefing_text = UI.paragraph(""); briefing_text.add_theme_font_size_override("font_size", 12); compare_panel.add_child(briefing_text)
	issue_text = UI.paragraph(""); issue_text.add_theme_font_size_override("font_size", 12); compare_panel.add_child(issue_text)
	rejoin = UI.paragraph(""); rejoin.add_theme_font_size_override("font_size", 12); compare_panel.add_child(rejoin)
	estimates = UI.paragraph(""); estimates.add_theme_font_size_override("font_size", 12); compare_panel.add_child(estimates)
	var actions = HFlowContainer.new(); compare_panel.add_child(actions)
	box_now = UI.button("Box from this forecast", commit_preview, true); actions.add_child(box_now)
	extend_draft = UI.button("Put extension in draft", draft_extension); actions.add_child(extend_draft)
	compare_panel.move_child(actions, 2)
	compare_panel.add_child(UI.paragraph("Uncalibrated model ranges. Current water and observed rival pace are held constant; future rival stops, incidents and weather are unknown. An extra stop pays the whole pit loss. Pausing and reading do not change the race."))
	load_current(true); show_topic(0)

func stack_field(parent: Node, text: String, control: Control) -> void:
	var label = UI.paragraph(text); label.add_theme_font_size_override("font_size", 11); parent.add_child(label)
	control.size_flags_horizontal = Control.SIZE_EXPAND_FILL; parent.add_child(control)

func show_topic(index: int) -> void:
	topic = index
	for i in range(topic_panels.size()):
		topic_panels[i].visible = i == index
		topic_buttons[i].modulate = Color.WHITE if i == index else Color(0.78, 0.78, 0.78)

func select_driver(id: int) -> void:
	if id not in [3, 6] or driver_id == id: return
	live_preview = {}
	driver_id = id; target_picker.select(0 if id == 3 else 1)
	load_current(false)

func populate_sets(control: OptionButton, selected: String) -> void:
	control.clear()
	for item in model.cars[driver_id].tyre_sets:
		control.add_item("%s · %.0f%% %s" % [item.label, item.life, "used" if item.used else "fresh"])
		var i = control.item_count - 1; control.set_item_metadata(i, item.id)
		control.set_item_disabled(i, not WheelTyres.usable(item))
		if item.id == selected: control.select(i)

func new_draft(template: String) -> void:
	var draft = StrategyPlan.draft(model.cars[driver_id], model.laps, template)
	if model.phase == "race": draft.starting_set = model.cars[driver_id].set_id
	drafts[driver_id] = draft; revisions[driver_id] = model.policy(driver_id).revision; dirty[driver_id] = true
	show_draft()

func load_current(discard: bool) -> void:
	if discard or not drafts.has(driver_id):
		var current = model.active_plan(driver_id)
		drafts[driver_id] = StrategyPlan.draft(model.cars[driver_id], model.laps) if current.is_empty() else current
		if model.phase == "race": drafts[driver_id].starting_set = model.cars[driver_id].set_id
		revisions[driver_id] = model.policy(driver_id).revision; dirty[driver_id] = current.is_empty()
	show_draft()

func show_draft() -> void:
	loading = true
	var draft = drafts[driver_id]
	objective.select(StrategyPlan.OBJECTIVES.find(draft.objective)); populate_sets(starting_set, draft.starting_set)
	stop_count.value = draft.stops.size()
	for i in range(3):
		var stop = draft.stops[i] if i < draft.stops.size() else {"from_lap": mini(model.laps - 1, 2 + i * 3), "to_lap": mini(model.laps - 1, 3 + i * 3), "set_id": "%d-H%d" % [driver_id, (i % 2) + 1]}
		stop_rows[i].first.value = stop.from_lap; stop_rows[i].last.value = stop.to_lap; populate_sets(stop_rows[i].set, stop.set_id)
		stop_rows[i].row.visible = i < draft.stops.size()
	avoid_traffic.set_pressed_no_signal("avoid_traffic" in draft.branches); emergency.set_pressed_no_signal(draft.allow_emergency)
	tyre_target.value = draft.tyre_reserve; fuel_target.value = draft.fuel_reserve
	loading = false; preview = {}; refresh(true)

func changed() -> void:
	if loading: return
	var stops: Array = []
	for i in range(3):
		stop_rows[i].row.visible = i < int(stop_count.value)
		if i < int(stop_count.value): stops.append({"from_lap": int(stop_rows[i].first.value), "to_lap": int(stop_rows[i].last.value), "set_id": stop_rows[i].set.get_item_metadata(stop_rows[i].set.selected)})
	drafts[driver_id] = {"version": 1, "driver_id": driver_id, "objective": StrategyPlan.OBJECTIVES[objective.selected], "starting_set": starting_set.get_item_metadata(starting_set.selected),
		"stops": stops, "branches": ["avoid_traffic"] if avoid_traffic.button_pressed else [], "allow_emergency": emergency.button_pressed, "tyre_reserve": tyre_target.value, "fuel_reserve": fuel_target.value}
	dirty[driver_id] = true; preview = {}; refresh(true)

func apply() -> void:
	command_requested.emit("approve_plan", {"id": driver_id, "revision": revisions[driver_id], "plan": drafts[driver_id].duplicate(true)})
	if model.policy(driver_id).revision != revisions[driver_id] and model.policy(driver_id).plan == drafts[driver_id]:
		revisions[driver_id] = model.policy(driver_id).revision; dirty[driver_id] = false
	refresh(true)

func commit_preview() -> void:
	if preview.is_empty(): return
	command_requested.emit("pit", {"id": driver_id, "forecast_key": preview.key, "forecast_time": preview.time, "expected_gate": preview.gate.distance, "set_id": preview.replacement_id})
	preview = {}; refresh(true)

func draft_extension() -> void:
	for candidate in preview.get("options", []):
		if candidate.id != "extend" or not candidate.available: continue
		var stops: Array = []
		for stop in candidate.stops:
			var lap = roundi(stop.at - model.track.pit_entry / model.track.length) + 1
			stops.append({"from_lap": lap, "to_lap": lap, "set_id": stop.set_id})
		drafts[driver_id].stops = stops
		drafts[driver_id].starting_set = model.cars[driver_id].set_id
		dirty[driver_id] = true; show_draft(); show_topic(1); return

func refresh(force: bool = false) -> void:
	if model == null or draft_status == null or not drafts.has(driver_id): return
	var c = model.cars[driver_id]; var policy = model.policy(driver_id)
	var draft = drafts[driver_id]
	var error = StrategyPlan.validate(draft, c, model.laps, maxi(1, int(floor(c.distance / model.track.length)) + 1) if model.phase == "race" else 0)
	if int(revisions[driver_id]) != int(policy.revision): error = "A newer plan is active. Discard/reload before applying."
	var legal = model.phase in ["briefing", "race_preparation", "race"] and c.route != "pit" and not c.pit_order and not c.dnf and not c.finished
	apply_button.disabled = not legal or not error.is_empty()
	clear_button.disabled = not legal or policy.plan.is_empty()
	apply_button.text = "Approve %s plan · delegate pits" % c.short
	apply_button.tooltip_text = error if not error.is_empty() else "Approve only when no physical stop is already ordered."
	draft_status.text = ("UNAPPLIED DRAFT · " if dirty[driver_id] else "APPROVED PLAN · ") + (error if not error.is_empty() else "Window edits stay here until you approve.")
	plan_status.text = "%s · %s · revision %d
%s" % [c.short, policy.plan_status.replace("_", " "), policy.revision, StrategyPlan.ownership_text(policy)]
	var other_plan = model.active_plan(6 if driver_id == 3 else 3)
	var overlaps: Array[String] = []
	for own_stop in draft.stops:
		for other_stop in other_plan.get("stops", []):
			if own_stop.from_lap <= other_stop.to_lap and other_stop.from_lap <= own_stop.to_lap:
				overlaps.append("laps %d–%d" % [maxi(own_stop.from_lap, other_stop.from_lap), mini(own_stop.to_lap, other_stop.to_lap)])
	if not overlaps.is_empty(): draft_status.text += "\nTEAM BOX · Windows overlap on " + ", ".join(overlaps) + ". A queue is possible, not certain; stagger or accept the exposure."
	starting_set.disabled = model.phase == "race"
	for channel in ownership_controls:
		ownership_controls[channel].select(0 if policy.owners[channel] == "engineer" else 1)
		ownership_controls[channel].disabled = c.dnf or c.finished
	var active: Array[String] = []
	for channel in policy.overrides: active.append("%s: %.1f laps left, then %s" % [channel.capitalize(), maxf(0, policy.overrides[channel].until_distance - c.distance) / model.track.length, policy.owners[channel]])
	override_label.text = "No temporary override. Direct modes remain manual until returned." if active.is_empty() else "
".join(active)
	for button in action_buttons: button.disabled = model.phase != "race" or c.dnf or c.finished
	if force or preview.is_empty() or RaceForecaster.stale(model, preview, int(policy.revision)) or model.total_time - last_refresh >= 3:
		preview = model.forecast(driver_id, draft if dirty[driver_id] else {}); last_refresh = model.total_time
		preview_changed.emit(preview)
	briefing_text.visible = model.phase in ["briefing", "race_preparation", "qualifying_results"]
	if briefing_text.visible: briefing_text.text = WeekendScenarios.briefing(model)
	if live_preview.is_empty() or RaceForecaster.stale(model, live_preview, int(policy.revision)) or model.total_time - live_preview.time >= 3:
		live_preview = model.forecast(driver_id)
	var current_cards = DecisionFeed.for_driver(model, driver_id, policy, live_preview)
	var descriptions: Array[String] = []
	for card in current_cards:
		descriptions.append(("Acknowledged · " if card.acknowledged else "") + card.title + "\n" + card.evidence + "\n" + card.fallback)
	issue_text.text = "\n\n".join(descriptions)
	issue_text.visible = not descriptions.is_empty()
	var pit = preview.pit
	rejoin.text = "%s · rejoin estimate P%d–P%d
Net pit loss %.1f–%.1fs · box wait ~%.1fs
%s" % [c.short, pit.position_low, pit.position_high, pit.loss_low, pit.loss_high, pit.queue, "Traffic: " + ", ".join(pit.traffic) if not pit.traffic.is_empty() else "No close rejoin traffic in this snapshot."]
	if c.route == "pit": rejoin.text = "COMMITTED PIT VISIT · Service uses the frozen plan. Future strategy comparisons resume after rejoin."
	var lines: Array[String] = ["UNAPPLIED DRAFT COMPARISON" if dirty[driver_id] else "CURRENT PLAN COMPARISON"]
	for option in preview.options:
		if not option.available: lines.append(option.title + " · " + option.reason); continue
		lines.append("%s
~%.0f–%.0fs remaining · %s risk · %+.1fs vs baseline" % [option.title, option.low, option.high, option.risk, option.gain])
	lines.append("Snapshot tick %d · current conditions only" % preview.tick); estimates.text = "

".join(lines)
	box_now.disabled = model.phase != "race" or c.route != "track" or c.pit_order or c.dnf or c.finished or preview.replacement_id.is_empty() or preview.gate.distance >= model.laps * model.track.length
	box_now.text = "Box %s · %s · lap %d" % [c.short, preview.replacement_id.get_slice("-", 1), preview.gate.lap]
	box_now.tooltip_text = "This explicit action changes only pit ownership and commits the displayed replacement at the safe entry."
	extend_draft.disabled = true
	for option in preview.options:
		if option.id == "extend" and option.available: extend_draft.disabled = false

static func compact_button(button: Button) -> void:
	button.custom_minimum_size.y = 30
	button.add_theme_font_size_override("font_size", 12)
	# Detached controls have Godot's fallback gray styles, not this application's theme.
	# Preserve explicit primary styles; build the normal palette without relying on tree order.
	var colors = {"normal": UI.CARD, "hover": UI.HOVER, "pressed": UI.SELECTED, "hover_pressed": UI.SELECTED, "disabled": UI.PANEL}
	for state in colors:
		var style = button.get_theme_stylebox(state).duplicate() if button.has_theme_stylebox_override(state) else UI.action_box(colors[state], UI.ACCENT if state in ["pressed", "hover_pressed"] else UI.LINE)
		style.content_margin_top = 6; style.content_margin_bottom = 6
		style.content_margin_left = 8; style.content_margin_right = 8
		button.add_theme_stylebox_override(state, style)
