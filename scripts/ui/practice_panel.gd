class_name PracticePanel
extends VBoxContainer
## Per-driver unapplied run drafts. Commands remain fixed above scrolling evidence.
signal command_requested(action: String, payload: Dictionary)
var model: PracticeRaceSim
var driver_id = 3
var drafts: Dictionary = {}
var preview: Dictionary = {}
var driver_buttons: Array[Button] = []
var start: Button
var run: Button
var recall: Button
var finish: Button
var summary: Label
var purpose: OptionButton
var sets: OptionButton
var lap_count: SpinBox
var baseline: OptionButton
var setup_summary: Label
var forecast_text: Label
var evidence: Label
var scroll: ScrollContainer
var binding = false
var confirmation: ConfirmationDialog

func configure(value: PracticeRaceSim) -> void:
	model = value
	for id in [3, 6]: drafts[id] = {"objective": "tyre_life", "set_id": model.cars[id].set_id, "laps": 2, "baseline": "current"}

func _ready() -> void:
	add_theme_constant_override("separation", 6)
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	var targets = UI.hbox(self)
	for id in [3, 6]:
		var button = UI.button(model.cars[id].short + " practice", func(): choose_driver(id))
		targets.add_child(button); driver_buttons.append(button)
	var actions = HFlowContainer.new(); add_child(actions)
	start = UI.button("Start practice", func(): command_requested.emit("practice_start", {})); actions.add_child(start)
	run = UI.button("Run MER", submit_run, true); actions.add_child(run)
	recall = UI.button("Recall MER", func(): command_requested.emit("practice_recall", {"id": driver_id})); actions.add_child(recall)
	finish = UI.button("End practice…", finish_session); actions.add_child(finish)
	for button in [start, run, recall, finish]: RecoveryPanel.compact(button)
	summary = UI.paragraph(""); summary.add_theme_font_size_override("font_size", 12); add_child(summary)
	scroll = ScrollContainer.new(); scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED; add_child(scroll)
	var body = UI.vbox(scroll); body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.add_child(UI.paragraph("Optional information, not a setup bonus. Keep your best sets for qualifying, or spend a used set to learn. Three runs per driver; one to four measured laps per run.", UI.MUTED))
	purpose = UI.option(PracticeEvidence.OBJECTIVES.values(), func(index): update_draft("objective", PracticeEvidence.OBJECTIVES.keys()[index]))
	UI.field(body, "RUN OBJECTIVE · unapplied", purpose)
	sets = OptionButton.new(); sets.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sets.item_selected.connect(func(index): update_draft("set_id", model.cars[driver_id].tyre_sets[index].id))
	UI.field(body, "DRIVER-OWNED TYRE SET", sets)
	lap_count = UI.spin(2, 1, PracticeEvidence.MAX_LAPS, 1, func(value): update_draft("laps", int(value)))
	UI.field(body, "MEASURED LAPS · plus out/in lap", lap_count)
	baseline = UI.option(PracticeEvidence.BASELINES.values(), func(index): update_draft("baseline", PracticeEvidence.BASELINES.keys()[index]))
	UI.field(body, "SETUP TO APPLY ON RELEASE", baseline)
	setup_summary = UI.paragraph(""); body.add_child(setup_summary)
	body.add_child(UI.paragraph("Current uses your applied Car / Setup values. Named baselines are trade-offs, not circuit optima. Run applies the draft setup and fits the named set; finishing keeps that setup. Pace and engine return to their prior values.", UI.MUTED))
	forecast_text = UI.paragraph(""); body.add_child(forecast_text)
	body.add_child(UI.label("MEASURED RUNS & LEARNING", 13, UI.ACCENT))
	evidence = UI.paragraph(""); body.add_child(evidence)
	choose_driver(driver_id)

func choose_driver(id: int) -> void:
	if id not in [3, 6]: return
	driver_id = id
	if purpose == null: return
	binding = true
	var draft = drafts[id]
	purpose.select(PracticeEvidence.OBJECTIVES.keys().find(draft.objective))
	baseline.select(PracticeEvidence.BASELINES.keys().find(draft.baseline))
	lap_count.set_value_no_signal(draft.laps)
	sets.clear()
	for item in model.cars[id].tyre_sets:
		sets.add_item("%s · %.0f%% tread · %s" % [item.id, item.life, "used" if item.used else "fresh"])
		sets.set_item_disabled(sets.item_count - 1, not WheelTyres.usable(item))
		if item.id == draft.set_id: sets.select(sets.item_count - 1)
	binding = false; refresh()

func update_draft(key: String, value: Variant) -> void:
	if binding: return
	drafts[driver_id][key] = value; refresh()

func submit_run() -> void:
	if preview.is_empty() or run.disabled: return
	command_requested.emit("practice_run", {"id": driver_id, "plan": drafts[driver_id].duplicate(true),
		"revision": preview.revision, "time": preview.time, "key": preview.key})
	refresh()

func finish_session() -> void:
	if model.phase == "practice_results": command_requested.emit("practice_finish", {}); return
	if model.phase != "practice" or model.practice_state.closed or is_instance_valid(confirmation): return
	confirmation = ConfirmationDialog.new(); confirmation.title = "End practice for both drivers?"
	confirmation.dialog_text = "No further runs start. Existing measured laps can finish, then cars return physically. Complete and partial observations stay in the report. Race time controls are unchanged."
	add_child(confirmation)
	PitwallDesign.scale_controls(confirmation, float(App.settings.get("pitwall_text_scale", 1.0)))
	confirmation.confirmed.connect(func(): confirmation.queue_free(); command_requested.emit("practice_end", {}))
	confirmation.canceled.connect(func(): confirmation.queue_free(); PitwallDesign.focus_later(finish))
	confirmation.popup_centered(Vector2i(520, 200))

func refresh() -> void:
	if summary == null: return
	var c = model.cars[driver_id]; var d = model.practice_driver(driver_id); var state = model.practice_state
	# Retain a displayed release snapshot between modest revisions. Activation submits it unchanged.
	if preview.is_empty() or preview.driver_id != driver_id or preview.get("draft", {}) != drafts[driver_id] or model.total_time - preview.time >= 3 or preview.key != PracticeEvidence.state_key(state, c):
		preview = model.run_preview(driver_id, drafts[driver_id]); preview.draft = drafts[driver_id].duplicate(true)
	for i in range(2): UI.set_active(driver_buttons[i], driver_id == [3, 6][i])
	start.visible = model.phase == "briefing" and state.status == "available"
	run.visible = model.phase == "practice"; recall.visible = run.visible
	run.disabled = not preview.available; run.text = "Run " + c.short
	run.tooltip_text = preview.reason if run.disabled else "Commit %s's displayed objective, set and setup. Only practice settings are applied; race ownership is unchanged." % c.short
	recall.text = "Recall " + c.short
	recall.disabled = d.active.is_empty() or d.active.get("returning", false) or c.pit_stage == "entry"
	recall.tooltip_text = "Return at the next physical entry. An interrupted lap does not become a clean full-lap sample."
	finish.visible = model.phase in ["practice", "practice_results"]
	finish.text = "Return to briefing" if model.phase == "practice_results" else ("Returning cars…" if state.closed else "End practice…")
	finish.disabled = model.phase == "practice" and state.closed
	for i in range(c.tyre_sets.size()):
		var item = c.tyre_sets[i]
		sets.set_item_text(i, "%s · %.0f%% tread · %s" % [item.id, item.life, "used" if item.used else "fresh"])
		sets.set_item_disabled(i, not WheelTyres.usable(item))
	var draft = drafts[driver_id]
	var applied_setup = PracticeEvidence.setup_for(c, draft.baseline)
	summary.text = "%s · %d/3 runs · draft %s / %d laps" % [c.short, d.runs.size(), draft.set_id, draft.laps]
	setup_summary.text = "Setup on release: wing %d / balance %d / suspension %d / cooling %d / bias %d%%" % [applied_setup.wing, applied_setup.balance, applied_setup.suspension, applied_setup.cooling, applied_setup.bias]
	if not d.active.is_empty(): summary.text = "%s · %s · %d/%d measured laps · %s" % [c.short, c.qual_state.to_upper(), d.runs.back().samples.size(), d.runs.back().target, d.runs.back().set_id]
	if state.status == "legacy": summary.text = c.short + " · Older weekend: no practice history. Start a new normal weekend to use optional practice."
	forecast_text.text = "Run estimate ~%.0fs simulated (~%.0fs at %d×); session remaining %.0fs. Garage fuel load %.2f lap units, including return reserve.\n%s" % [preview.duration, preview.duration / model.speed, model.speed, preview.remaining, preview.fuel, preview.limit]
	if not preview.available: forecast_text.text = preview.reason + "\n" + forecast_text.text
	var priors = model.forecast_parameters(driver_id).get("practice", {})
	forecast_text.text += "\n\nForecast learning: " + ("no matching clean samples; baseline estimates." if priors.is_empty() else " / ".join(priors.keys().map(func(key): return key + ": " + priors[key].label)))
	evidence.text = PracticeEvidence.report(state, driver_id)
	for control in [purpose, sets, baseline]: control.disabled = not d.active.is_empty() or state.status in ["complete", "skipped", "legacy"]
	lap_count.editable = d.active.is_empty() and state.status in ["available", "running"]
