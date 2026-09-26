class_name RacePracticeWorkspace
extends VBoxContainer
## Both drivers' independent real programme drafts, in one engineering workspace.
signal command_requested(action: String,payload: Dictionary)
signal close_requested
var model: PracticeRaceSim
var panels: Dictionary = {}
var badges: Dictionary = {}
var session_action: Button
var finish: Button
var summary: Label
func configure(value: PracticeRaceSim) -> void: model = value
func _ready() -> void:
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	var top = UI.hbox(self)
	var title = UI.label("PRACTICE / ENGINEERING",PitwallDesign.TYPE.display,UI.ACCENT); title.size_flags_horizontal = Control.SIZE_EXPAND_FILL; top.add_child(title)
	top.add_child(UI.button("Back to pit wall",func(): close_requested.emit()))
	summary = UI.paragraph("Optional measured learning. Two drivers, independent tyre sets and run drafts. No hidden setup score."); add_child(summary)
	var row = UI.hbox(self,true)
	for id in [3,6]:
		var surface = PitwallDesign.race_panel(false,10); surface.size_flags_horizontal = Control.SIZE_EXPAND_FILL; surface.size_flags_vertical = Control.SIZE_EXPAND_FILL; row.add_child(surface)
		var body = UI.vbox(surface,true)
		body.add_child(UI.label(model.cars[id].name.to_upper(),PitwallDesign.TYPE.heading,UI.INK))
		var badge = RaceStatusBadge.new(); body.add_child(badge); badges[id] = badge
		var panel = RacePracticeProgrammeCard.new(); panel.configure(model); body.add_child(panel); panels[id] = panel
		panel.choose_driver(id); panel.driver_buttons[0].get_parent().hide()
		panel.command_requested.connect(func(action,payload): command_requested.emit(action,payload))
	var actions = UI.hbox(self)
	session_action = UI.button("Start practice",func(): command_requested.emit("practice_start",{}),true); actions.add_child(session_action)
	finish = UI.button("End practice…",func(): panels[3].finish_session()); actions.add_child(finish)
func present() -> void:
	if panels.is_empty(): return
	var can_prepare = model.phase == "briefing" and model.practice_state.status == "available"
	var during = model.phase in ["practice", "practice_results"]
	for id in panels:
		var panel = panels[id]; panel.refresh(); panel.start.hide(); panel.finish.hide()
		var driver = model.practice_driver(id)
		var state = "RUNNING" if not driver.active.is_empty() else ("SESSION CLOSED" if model.practice_state.status == "complete" else "RUN LIMIT" if driver.runs.size() >= PracticeEvidence.MAX_RUNS else ("UNAVAILABLE" if model.practice_state.status in ["skipped", "legacy"] or not (can_prepare or during) else "READY"))
		badges[id].present(state + " · %d/%d runs" % [driver.runs.size(),PracticeEvidence.MAX_RUNS],"info")
	if model.phase == "practice":
		summary.text = "SESSION %s · %.0fs remaining · tyres, fuel and time are real resources" % [model.practice_state.status.to_upper(),maxf(0,model.practice_state.duration-model.clock)]
	elif can_prepare:
		summary.text = "OPTIONAL PRACTICE · %.0fs session · start when both run drafts are ready" % model.practice_state.duration
	else:
		summary.text = "PRACTICE EVIDENCE · %s · retained measurements, not a proposed new run" % model.practice_state.status.to_upper()
	session_action.visible = model.phase == "briefing" and model.practice_state.status == "available"
	finish.visible = model.phase in ["practice","practice_results"]
	finish.text = "Return to briefing" if model.phase == "practice_results" else "End practice…"
	finish.disabled = model.phase == "practice" and model.practice_state.closed
