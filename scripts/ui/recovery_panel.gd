class_name RecoveryPanel
extends VBoxContainer
## Actions are siblings of the scrolling evidence. Refresh never replaces a focused control.
signal command_requested(action: String, payload: Dictionary)
var model: RecoveryRaceSim
var driver_id = 3
var advice: Dictionary = {}
var selectors: Array[Button] = []
var status: Label
var protect_button: Button
var repair_button: Button
var retire_button: Button
var scroll: ScrollContainer
var details: VBoxContainer
var comparison: Label
var execution: Label
var authority_note: Label
var rules: Label
var authority: OptionButton
var budget: SpinBox
var apply_button: Button
var authority_revision = -1
var authority_dirty = false
var authority_drafts: Dictionary = {}
var retirement_dialog: ConfirmationDialog
var retirement_payload: Dictionary = {}

func configure(value: RecoveryRaceSim) -> void: model = value

func _ready() -> void:
	name = "Recovery"; add_theme_constant_override("separation", 7)
	var row = HBoxContainer.new(); add_child(row)
	for id in [3, 6]:
		var button = UI.button(model.cars[id].short + " recovery", func(): choose_driver(id)); row.add_child(button)
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL; compact(button); selectors.append(button)
	status = paragraph(); add_child(status)
	var actions = HBoxContainer.new(); add_child(actions)
	protect_button = UI.button("Protect", submit_protect); actions.add_child(protect_button)
	repair_button = UI.button("Repair only", submit_repair, true); actions.add_child(repair_button)
	retire_button = UI.button("Retire…", confirm_retirement); actions.add_child(retire_button)
	for button in [protect_button, repair_button, retire_button]: compact(button); button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll = ScrollContainer.new(); scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED; scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL; add_child(scroll)
	details = UI.vbox(scroll); details.size_flags_horizontal = Control.SIZE_EXPAND_FILL; details.add_theme_constant_override("separation", 9)
	comparison = paragraph(); details.add_child(comparison)
	execution = paragraph(); details.add_child(execution)
	details.add_child(UI.label("EMERGENCY REPAIR AUTHORITY", 11, UI.ACCENT))
	authority = UI.option(["Advice only", "Authorize critical repair"], func(_index): authority_dirty = true)
	details.add_child(authority)
	budget = UI.spin(12, 0, 30, 1, func(_value): authority_dirty = true); UI.field(details, "Repair work cap (s)", budget)
	apply_button = UI.button("Apply authority", submit_authority); compact(apply_button); details.add_child(apply_button)
	authority_note = paragraph(); details.add_child(authority_note)
	details.add_child(UI.label("RACE CONTROL / PUBLISHED RULES", 11, UI.ACCENT))
	rules = paragraph(); details.add_child(rules)
	var explanation = paragraph(); explanation.text = "The car has aggregate damage and lifetime health, not diagnosed component failures. A damage repair takes real service time but does not replenish health. Protect saves engine resources for two laps and returns the previous engine owner. It leaves your pit plan alone.\n\nReading this panel, scrolling, declining a confirmation and opening the guide never change the race or its speed."; details.add_child(explanation)
	retirement_dialog = ConfirmationDialog.new(); retirement_dialog.title = "Confirm driver retirement"; retirement_dialog.min_size = Vector2i(400, 170); add_child(retirement_dialog)
	retirement_dialog.confirmed.connect(func():
		if retirement_payload.is_empty(): return
		var payload = retirement_payload.duplicate(true); retirement_payload = {}
		command_requested.emit("recovery_retire", payload); advice = {}; refresh())
	retirement_dialog.canceled.connect(func(): retirement_payload = {})
	refresh()

static func compact(button: Button) -> void:
	StrategyDesk.compact_button(button); button.add_theme_font_size_override("font_size", 11)

static func paragraph() -> Label:
	var label = UI.paragraph(""); label.add_theme_font_size_override("font_size", 12); return label

func choose_driver(id: int) -> void:
	if id not in [3, 6]: return
	if driver_id != id:
		if authority_dirty: authority_drafts[driver_id] = {"value": authority.selected, "budget": budget.value, "revision": authority_revision}
		driver_id = id; authority_dirty = false; authority_revision = -1; advice = {}
		if authority_drafts.has(id):
			var draft = authority_drafts[id]; authority.select(draft.value); budget.set_value_no_signal(draft.budget)
			authority_revision = draft.revision; authority_dirty = true
	refresh()

func payload() -> Dictionary:
	return {"id": driver_id, "time": advice.time, "key": advice.key, "gate": advice.gate.distance}

func submit_protect() -> void:
	if advice.is_empty() or protect_button.disabled: return
	command_requested.emit("recovery_protect", payload()); advice = {}; refresh()

func submit_repair() -> void:
	if advice.is_empty() or repair_button.disabled: return
	# Send exactly the displayed comparison, never silently reprice a stale command.
	command_requested.emit("recovery_repair", payload()); advice = {}; refresh()

func confirm_retirement() -> void:
	if advice.is_empty() or retire_button.disabled: return
	retirement_payload = payload(); retirement_payload.confirm = true
	retirement_dialog.title = "Retire " + model.cars[driver_id].short + "?"
	retirement_dialog.dialog_text = "Retire %s from this race. This is irreversible and retains a classified retirement.\n\nThe race continues at your selected speed. If the source conditions change while this confirmation is open, the command will be rejected." % model.cars[driver_id].short
	retirement_dialog.popup_centered(Vector2i(460, 205))

func submit_authority() -> void:
	command_requested.emit("recovery_authority", {"id": driver_id, "revision": authority_revision, "value": ["advise", "repair"][authority.selected], "budget": budget.value})
	authority_drafts.erase(driver_id); authority_dirty = false; authority_revision = -1; advice = {}; refresh()

func refresh() -> void:
	if model == null or status == null: return
	if advice.is_empty() or model.recovery_stale(advice) or model.total_time - advice.time >= 2: advice = model.recovery_advice(driver_id)
	var c = model.cars[driver_id]; var r = model.reliability(driver_id); var p = model.policy(driver_id)
	var observed = advice.observed
	for i in range(2): selectors[i].disabled = driver_id == [3, 6][i]
	var legal = model.enhanced() and model.phase == "race" and c.route == "track" and not c.dnf and not c.finished
	protect_button.disabled = not legal; retire_button.disabled = not legal; repair_button.disabled = not legal or not advice.repair_available
	status.text = "%s · %s\nDamage %.0f · health %.0f%% · heat %.0f°C" % [c.short, observed.stage.to_upper(), observed.damage, observed.health, observed.temperature]
	if not model.enhanced(): status.text = c.short + " · LEGACY MODEL\nOriginal reliability and flag behavior retained."
	protect_button.tooltip_text = c.short + ": engine saving for two laps; gradual cooling; pit ownership unchanged."
	repair_button.tooltip_text = c.short + ": repair scalar damage; retain fitted tyres." if advice.repair_available else advice.unavailable_reason
	retire_button.tooltip_text = "Irreversibly retire " + c.short + "; confirmation required."
	comparison.text = "KEEP CURRENT ORDERS\nEstimated lap %.1fs; present exposure %s. No instruction is changed by reading this panel.\n\nPROTECT FOR TWO LAPS\nEstimated lap %.1fs at current heat. Temperature changes gradually; finish risk is not a calibrated probability.\n\nREPAIR AT NEXT SAFE ENTRY\nEstimated lap after repair %.1fs; repair work %.1fs. Lifetime health remains %.0f%%." % [advice.current_lap, observed.exposure, advice.protected_lap, advice.repaired_lap, advice.repair_seconds, observed.health]
	if advice.payback_laps >= 0: comparison.text += "\nBreak-even ~%.1f laps versus %.1f laps remaining." % [advice.payback_laps, advice.remaining_laps]
	else: comparison.text += "\nNo current pace payback is predicted under these conditions."
	if c.pit_order:
		execution.text = "ACCEPTED ORDER\n" + model.pit_status(c) + ("\nRepair only: fitted tyres and current stint retained." if r.repair_only else "\nThe existing tyre/service order remains authoritative.")
	elif advice.repair_available:
		execution.text = "SAFE ENTRY L%d%s\nDecision closes in ~%.0fs simulated (~%.1fs at %d×).\nEstimated total visit %.0f–%.0fs; net pit loss %.0f–%.0fs; queue ~%.1fs.\nAfter a manual repair call, pit ownership is yours. Re-approve remaining tyre windows." % [advice.gate.lap, " · deferred" if advice.gate.deferred else "", advice.gate.deadline, advice.gate.deadline / model.speed, model.speed, advice.pit.visit_low, advice.pit.visit_high, advice.pit.loss_low, advice.pit.loss_high, advice.pit.queue]
	else: execution.text = "REPAIR UNAVAILABLE\n" + advice.unavailable_reason
	execution.text += "\n\n" + advice.limitations
	if not authority_dirty and authority_revision != r.revision:
		authority.select(0 if r.emergency == "advise" else 1); budget.set_value_no_signal(r.repair_budget); authority_revision = int(r.revision)
	apply_button.disabled = not model.enhanced() or model.phase not in ["briefing", "race_preparation", "race"] or c.dnf or c.finished
	authority_note.text = "Current: %s, up to %.0fs additional repair work. Pit owner: %s.\nThis allows an extra critical repair-only stop only with engineer pit ownership and approved emergency permission. Existing scheduled tyre/repair choices are separate. No automatic retirement or pause." % [r.emergency, r.repair_budget, p.owners.pit]
	if authority_dirty: authority_note.text = "UNAPPLIED AUTHORITY DRAFT\n" + authority_note.text
	if not r.service.is_empty(): authority_note.text += "\nService plan frozen; elapsed ~%.1fs of planned %.1fs." % [maxf(0, model.total_time - r.service.started), r.service.duration]
	if model.enhanced():
		var control = WeekendRaceControl.public_view(model.control_state, model.total_time)
		rules.text = control.flag + " · " + control.reason
		if control.state != "green": rules.text += "\nPhase transition in %.1fs simulated (~%.1fs at %d×); a new hazard can extend it." % [control.remaining, control.remaining / model.speed, model.speed]
		for zone in control.zones: rules.text += "\nLocal yellow S%d · %.1fs remaining." % [zone.sector + 1, zone.remaining]
		rules.text += "\n\n" + control.rules + "\n\nThis is a fictional game procedure, not a physical safety car or licensed-series rules. No red flags, stewarding penalties or automatic field bunching are modeled."
	else: rules.text = "Legacy speed-capped flags are retained for this save. Start a new normal weekend to use the virtual-neutralization procedure."
