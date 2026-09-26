class_name RaceDecisionDrawer
extends VBoxContainer
## Non-modal evidence → explicit confirmation → authoritative command → outcome.
## Never silently recomputes a displayed commitment. Stale evidence needs Refresh.
signal command_requested(action: String, payload: Dictionary)
signal refresh_requested(id: int)
signal detail_requested(id: int)
var model: StrategyRaceSim
var snapshot: Dictionary = {}
var stage = "REVIEW"
var pending_action = ""
var pending_payload: Dictionary = {}
var issue_selector: OptionButton
var issue_choices: Array = []
var heading: Label
var facts: Label
var evidence: Label
var measured: Label
var estimated: Label
var source_status: Label
var status: RaceStatusBadge
var comparison: PitwallComparison
var commit_bar: VBoxContainer
var box: Button
var hold: Button
var refresh_button: Button
var cancel: Button
var fuel: Button
var release: Button
var message: Label
var stale = false
# At most one last accepted receipt per owned driver; not a second draft/command store.
var receipts: Dictionary = {}
var receipt: Dictionary = {}
var submit_sequence = -1

func configure(value: StrategyRaceSim) -> void:
	if model != value: receipts.clear(); receipt.clear()
	model = value

func _ready() -> void:
	add_theme_constant_override("separation", 8)
	status = RaceStatusBadge.new(); add_child(status)
	heading = UI.paragraph("Review a decision",UI.INK); heading.add_theme_font_size_override("font_size",PitwallDesign.TYPE.heading); add_child(heading)
	issue_selector = OptionButton.new(); issue_selector.fit_to_longest_item = false; add_child(issue_selector)
	issue_selector.accessibility_name = "Issue to review for the named driver"
	issue_selector.item_selected.connect(select_issue)
	facts = UI.paragraph(""); add_child(facts);facts.hide()
	var metrics=UI.hbox(self)
	measured=UI.paragraph("");metrics.add_child(measured)
	estimated=UI.paragraph("");metrics.add_child(estimated)
	evidence = UI.paragraph("No active decision."); add_child(evidence)
	comparison = PitwallComparison.new(); add_child(comparison)
	source_status = UI.paragraph(""); source_status.add_theme_font_size_override("font_size",11); add_child(source_status)
	commit_bar = UI.vbox(self)
	message = UI.paragraph(""); commit_bar.add_child(message)
	var actions = HFlowContainer.new(); commit_bar.add_child(actions)
	box = UI.button("Box from evidence", func(): prepare("pit"), true); actions.add_child(box)
	fuel = UI.button("Save fuel", func(): prepare("resource_intent")); actions.add_child(fuel)
	release = UI.button("Release now", func(): prepare("send"), true); actions.add_child(release)
	hold = UI.button("Keep plan", keep_plan); actions.add_child(hold)
	cancel = UI.button("Back to review", reset_review); actions.add_child(cancel)
	refresh_button = UI.button("Refresh evidence", func(): refresh_requested.emit(snapshot.get("driver_id",3))); actions.add_child(refresh_button)
	var details = UI.button("Open full strategy", func(): detail_requested.emit(snapshot.get("driver_id",3))); actions.add_child(details)

func present(value: Dictionary, new_review: bool = false) -> void:
	# Reopening is observational. A fresh review requires the explicit review action.
	receipt = {} if new_review else receipts.get(int(value.get("driver_id", -1)), {})
	snapshot = value.duplicate(true) if receipt.is_empty() else receipt.snapshot.duplicate(true)
	stage = "REVIEW" if receipt.is_empty() else "EXECUTING"
	pending_action = "" if receipt.is_empty() else receipt.action
	pending_payload = {} if receipt.is_empty() else receipt.payload.duplicate(true)
	message.text = "Choose an option to review its commitment. Reading does not pause the race."
	if snapshot.is_empty(): return
	heading.text = snapshot.name + " · " + snapshot.primary.get("title","Review current plan")
	facts.text = "OBSERVED AT SNAPSHOT
P%d · fitted %s · tyre %.0f%%
Fuel remaining %.2f lap units
ESTIMATE · finish margin %+.1f laps
%s" % [snapshot.position,snapshot.set_id,snapshot.tyre,snapshot.fuel,snapshot.fuel_margin,snapshot.ownership]
	measured.text="OBSERVED\nP%d · %s · %.0f%% tyre\nFuel %.2f lap units" % [snapshot.position,snapshot.set_id,snapshot.tyre,snapshot.fuel]
	estimated.text="ESTIMATED\nFinish fuel %+.1f laps\nRejoin P%d–P%d" % [snapshot.fuel_margin,snapshot.forecast.pit.position_low,snapshot.forecast.pit.position_high]
	measured.tooltip_text=facts.text;estimated.tooltip_text=snapshot.ownership
	var lines: Array[String] = []
	for entry in snapshot.decisions:
		lines.append(("Acknowledged · " if entry.acknowledged else "") + entry.title + "
" + entry.evidence + "
" + entry.fallback)
	evidence.text = "

".join(lines) if not lines.is_empty() else "No pending issue. Existing plan and owners continue."
	evidence.text += "\n\n" + snapshot.get("battle", "") + "\n" + snapshot.get("battle_detail", "")
	issue_choices.clear(); issue_selector.clear()
	for entry in snapshot.decisions:
		if not entry.acknowledged: issue_choices.append(entry)
	for entry in issue_choices:
		issue_selector.add_item(entry.title)
		if entry.get("issue", "") == snapshot.primary.get("issue", ""): issue_selector.select(issue_selector.item_count - 1)
	issue_selector.visible = issue_choices.size() > 1
	comparison.present(snapshot.forecast)
	refresh_state()

func refresh_state() -> void:
	if snapshot.is_empty() or message == null: return
	var car = model.cars[int(snapshot.driver_id)]
	stale = RaceForecaster.stale(model,snapshot.forecast,int(model.policy(snapshot.driver_id).revision)) or snapshot.phase != model.phase
	var race = model.phase == "race"; var live = not car.dnf and not car.finished
	var locked = stage not in ["REVIEW", "CONFIRM"]
	var f = snapshot.forecast
	issue_selector.disabled = locked
	box.visible = race; fuel.visible = race and snapshot.primary.get("issue","")=="fuel"; release.visible = model.phase == "qualifying"
	box.disabled = locked or stale or not live or car.route != "track" or car.pit_order or f.replacement_id.is_empty() or f.gate.distance >= model.laps * model.track.length
	fuel.disabled = locked or stale or not live or not race
	release.disabled = locked or stale or not live or not RaceForecaster.qualifying_release(model,car).can_start_hotlap
	hold.disabled = locked or stale or snapshot.primary.is_empty()
	cancel.visible = stage == "CONFIRM"
	box.text = "Confirm %s pit call" % snapshot.name if stage == "CONFIRM" and pending_action == "pit" else "Box %s · lap %d" % [snapshot.short,f.gate.lap]
	fuel.text = "Confirm %s saving 2 laps" % snapshot.name if stage == "CONFIRM" and pending_action == "resource_intent" else "Save fuel 2 laps"
	release.text = "Confirm %s release" % snapshot.name if stage == "CONFIRM" and pending_action == "send" else "Release now"
	if stage == "EXECUTING" and not receipt.is_empty():
		var progress = RaceDecisionViewModel.receipt_progress(model, receipt)
		if progress.terminal:
			receipt.outcome = progress; stage = "OUTCOME"
		else:
			receipt.record_offset = model.strategy_state.records.size()
			if progress.has("entry_id"): receipt.entry_id = progress.entry_id
			if progress.has("recalled"): receipt.recalled = progress.recalled
		message.text = "%s · %s
%s" % [progress.label, snapshot.name, progress.detail]
	refresh_button.text = "Review a new decision" if locked else "Refresh evidence"
	refresh_button.disabled = stage == "SUBMITTING"

	status.present("STALE EVIDENCE" if stale and stage in ["REVIEW","CONFIRM"] else stage, "warning" if stale and not locked else "info")
	source_status.text = "Snapshot %.1fs · %s
Estimated rejoin P%d–P%d. Current conditions only; not a promised result.
%s" % [f.time,"accepted receipt · no repeat command" if locked else ("refresh required before commitment" if stale else "displayed assumptions still valid"),f.pit.position_low,f.pit.position_high,"Race is paused by you." if model.paused else "Race continues at %d×. Space pauses." % model.speed]
	for button in [box,fuel,release,hold]:
		button.tooltip_text = "Evidence is stale. Refresh explicitly; the displayed order is never replaced silently." if stale else "Targets " + snapshot.name + ". Confirm before issuing a new order."

func prepare(action: String) -> void:
	refresh_state()
	if snapshot.is_empty() or stale or stage not in ["REVIEW", "CONFIRM"]: return
	if (action == "pit" and box.disabled) or (action == "send" and release.disabled) or (action == "resource_intent" and fuel.disabled): return
	if stage == "CONFIRM" and pending_action == action:
		stage = "SUBMITTING"; submit_sequence = int(model.strategy_state.sequence)
		command_requested.emit(pending_action,pending_payload.duplicate(true)); return
	stage = "CONFIRM"; pending_action = action
	pending_payload = RaceDecisionViewModel.pit_payload(snapshot) if action == "pit" else {"id":snapshot.driver_id}
	if action == "resource_intent": pending_payload.merge({"channel":"engine","value":0,"laps":2})
	message.text = "CONFIRM · " + ("%s fits %s at safe entry lap %d. Pit ownership becomes manual; other owners stay unchanged." % [snapshot.name,snapshot.forecast.replacement_id,snapshot.forecast.gate.lap] if action == "pit" else ("%s saves fuel for two laps, then returns to the previous engine owner." % snapshot.name if action == "resource_intent" else "%s leaves the garage on the planned real tyre set." % snapshot.name))
	refresh_state()

func keep_plan() -> void:
	refresh_state()
	if hold.disabled: return
	var entry = snapshot.primary
	pending_action = "hold_decision"
	pending_payload = {"id":snapshot.driver_id,"issue":entry.issue,"key":entry.key}
	stage = "SUBMITTING"; submit_sequence = int(model.strategy_state.sequence)
	command_requested.emit(pending_action, pending_payload.duplicate(true))

func command_result(accepted: bool, reason: String, action: String) -> void:
	# Synchronous boundary today; also reject duplicate or mismatched late callbacks.
	if stage != "SUBMITTING" or action != pending_action: return
	if accepted:
		stage = "ACKNOWLEDGED" if action == "hold_decision" else "EXECUTING"
		if action != "hold_decision":
			receipt = RaceDecisionViewModel.accepted_receipt(model, snapshot, action, pending_payload, submit_sequence)
			receipts[int(snapshot.driver_id)] = receipt
		message.text = "Plan retained. No pit order, pause or speed change." if action == "hold_decision" else "Command accepted. Execution remains physical."
	else:
		stage = "REJECTED"; message.text = "Rejected · " + reason + ". Refresh or review; no replacement order was sent."
	refresh_state()

func reset_review() -> void:
	if stage not in ["REVIEW", "CONFIRM"]: return
	stage = "REVIEW"; pending_action = ""; pending_payload.clear()
	message.text = "No new command issued."; refresh_state()

func select_issue(index: int) -> void:
	# Select only from this immutable reviewed snapshot. No new source or order.
	if stage not in ["REVIEW", "CONFIRM"] or index < 0 or index >= issue_choices.size(): return
	reset_review()
	snapshot.primary = issue_choices[index].duplicate(true)
	heading.text = snapshot.name + " · " + snapshot.primary.title
	message.text = snapshot.primary.evidence + "\n" + snapshot.primary.fallback
	refresh_state()
