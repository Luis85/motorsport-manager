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

func configure(value: StrategyRaceSim) -> void: model = value

func _ready() -> void:
	add_theme_constant_override("separation", 8)
	status = RaceStatusBadge.new(); add_child(status)
	heading = UI.paragraph("Review a decision",UI.INK); heading.add_theme_font_size_override("font_size",PitwallDesign.TYPE.heading); add_child(heading)
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

func present(value: Dictionary) -> void:
	snapshot = value.duplicate(true); stage = "REVIEW"; pending_action = ""; pending_payload.clear()
	message.text = "Choose an option to review its commitment. Reading does not pause the race."
	if snapshot.is_empty(): return
	heading.text = snapshot.short + " · " + snapshot.primary.get("title","Review current plan")
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
	comparison.present(snapshot.forecast)
	refresh_state()

func refresh_state() -> void:
	if snapshot.is_empty() or message == null: return
	var car = model.cars[int(snapshot.driver_id)]
	stale = RaceForecaster.stale(model,snapshot.forecast,int(model.policy(snapshot.driver_id).revision)) or snapshot.phase != model.phase
	var race = model.phase == "race"; var live = not car.dnf and not car.finished
	var f = snapshot.forecast
	box.visible = race; fuel.visible = race and snapshot.primary.get("issue","")=="fuel"; release.visible = model.phase == "qualifying"
	box.disabled = stale or not live or car.route != "track" or car.pit_order or f.replacement_id.is_empty() or f.gate.distance >= model.laps * model.track.length
	fuel.disabled = stale or not live or not race
	release.disabled = stale or not live or not RaceForecaster.qualifying_release(model,car).can_start_hotlap
	hold.disabled = stale or snapshot.primary.is_empty() or stage in ["EXECUTING","OUTCOME","ACKNOWLEDGED"]
	cancel.visible = stage == "CONFIRM"
	box.text = "Confirm %s pit call" % snapshot.short if stage == "CONFIRM" and pending_action == "pit" else "Box %s · lap %d" % [snapshot.short,f.gate.lap]
	fuel.text = "Confirm saving 2 laps" if stage == "CONFIRM" and pending_action == "resource_intent" else "Save fuel 2 laps"
	release.text = "Confirm release" if stage == "CONFIRM" and pending_action == "send" else "Release now"
	if stage == "EXECUTING":
		if car.dnf or car.finished: stage = "OUTCOME"; message.text = "Session ended · inspect measured outcomes in Review / Debrief."
		elif car.pit_stops > snapshot.pit_stops and car.route == "track": stage = "OUTCOME"; message.text = "Pit visit completed · measured service and consequences are in Review / Debrief."
		else: message.text = "Accepted · " + model.pit_status(car) if pending_action == "pit" else "Accepted · current driver state: " + car.intent
	status.present("STALE EVIDENCE" if stale and stage in ["REVIEW","CONFIRM"] else stage, "warning" if stale else "info")
	source_status.text = "Snapshot %.1fs · %s
Estimated rejoin P%d–P%d. Current conditions only; not a promised result.
%s" % [f.time,"refresh required before commitment" if stale else "displayed assumptions still valid",f.pit.position_low,f.pit.position_high,"Race is paused by you." if model.paused else "Race continues at %d×. Space pauses." % model.speed]
	for button in [box,fuel,release,hold]:
		button.tooltip_text = "Evidence is stale. Refresh explicitly; the displayed order is never replaced silently." if stale else "Targets " + snapshot.name + ". Confirm before issuing a new order."

func prepare(action: String) -> void:
	refresh_state()
	if snapshot.is_empty() or stale: return
	if (action == "pit" and box.disabled) or (action == "send" and release.disabled) or (action == "resource_intent" and fuel.disabled): return
	if stage == "CONFIRM" and pending_action == action:
		command_requested.emit(pending_action,pending_payload.duplicate(true)); return
	stage = "CONFIRM"; pending_action = action
	pending_payload = RaceDecisionViewModel.pit_payload(snapshot) if action == "pit" else {"id":snapshot.driver_id}
	if action == "resource_intent": pending_payload.merge({"channel":"engine","value":0,"laps":2})
	message.text = "CONFIRM · " + ("%s fits %s at safe entry lap %d. Pit ownership becomes manual; other owners stay unchanged." % [snapshot.short,snapshot.forecast.replacement_id,snapshot.forecast.gate.lap] if action == "pit" else ("%s saves fuel for two laps, then returns to the previous engine owner." % snapshot.short if action == "resource_intent" else "%s leaves the garage on the planned real tyre set." % snapshot.short))
	refresh_state()

func keep_plan() -> void:
	refresh_state()
	if hold.disabled: return
	var entry = snapshot.primary
	command_requested.emit("hold_decision",{"id":snapshot.driver_id,"issue":entry.issue,"key":entry.key})

func command_result(accepted: bool, reason: String, action: String) -> void:
	if accepted:
		stage = "ACKNOWLEDGED" if action == "hold_decision" else "EXECUTING"
		message.text = "Plan retained. No pit order, pause or speed change." if action == "hold_decision" else "Command accepted. Execution remains physical."
	else:
		stage = "REVIEW"; message.text = "Not accepted: " + reason + ". Refresh or review; no replacement order was sent."
	refresh_state()

func reset_review() -> void:
	stage = "REVIEW"; pending_action = ""; pending_payload.clear()
	message.text = "No new command issued."; refresh_state()
