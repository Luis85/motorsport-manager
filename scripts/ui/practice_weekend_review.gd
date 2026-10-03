class_name PracticeWeekendReview
extends PitwallWorkspace
## Extends the merged task navigation; no replacement race shell or hidden time control.
signal replay_requested
var recording: RaceRecord
var review_actions: VBoxContainer
var replay_button: Button
var bookmark_button: Button
var accept_button: Button
var result_notice: Label
var practice_panel: PracticePanel
var practice_page_index = -1
var practice_button: Button
var practice_links: Dictionary = {}
var practice_debrief_prefix = ""
var strategy_navigation: HBoxContainer
var practice_report_stamp = -1
var rivals_button: Button
var public_inspector: PublicRivalInspector
var practice_workspace: RacePracticeWorkspace
var practice_dashboard_button: Button
var duel_workspace: DuelWorkspace


func build_replay_actions() -> void:
	weekend_menu.get_popup().add_separator()
	weekend_menu.get_popup().add_item("Replay / sandbox", 20)
	weekend_menu.get_popup().add_item("Circuit notebook…", 21)
	weekend_menu.get_popup().id_pressed.connect(
		func(id):
			if id == 20:
				replay_requested.emit()
			elif id == 21:
				NotebookWindow.open(self, recording, NotebookPort.PATH, weekend_menu),
	)
	navigator.catalog.append(
		[
			7,
			20,
			"Review / Replay and sandbox",
			"recording checkpoint try another decision original result"
		]
	)
	navigator.catalog.append(
		[
			7,
			21,
			"Review / Circuit notebook",
			"history observations personal notes remembered challenges"
		]
	)
	navigator.filter_views("")
	review_actions = VBoxContainer.new()
	detail_actions.add_child(review_actions)
	var actions = HFlowContainer.new()
	review_actions.add_child(actions)
	replay_button = UI.button("Replay / sandbox", func(): replay_requested.emit())
	actions.add_child(replay_button)
	bookmark_button = UI.button("Keep checkpoint", keep_checkpoint)
	actions.add_child(bookmark_button)
	accept_button = UI.button("Accept original result", accept_result, true)
	actions.add_child(accept_button)
	result_notice = (UI.paragraph(
		(
			"Original results require a completed weekend. Replays and experiments never "
			+ "award campaign rewards."
		)
	))
	review_actions.add_child(result_notice)
	PitwallDesign.scale_controls(review_actions, text_scale)


func open_destination(index: int, subtopic: int) -> void:
	if duel_workspace != null and index == duel_workspace.index and subtopic == 1:
		duel_workspace.panel.reading_requested.emit(
			"Tactical evidence", sim.tactical_debrief(), find_button
		)
		return
	if index == 7 and subtopic == 20:
		replay_requested.emit()
		return
	if index == 7 and subtopic == 21:
		NotebookWindow.open(self, recording, NotebookPort.PATH, find_button)
		return
	super.open_destination(index, subtopic)


func keep_checkpoint() -> void:
	if recording == null:
		return
	var error = recording.bookmark("%s · %.1fs" % [sim.phase.replace("_", " "), sim.total_time])
	result_notice.text = (
		"Checkpoint kept (%d/4). Save or export to retain it on disk." % recording.marks.size()
		if error.is_empty()
		else error
	)
	refresh()


func accept_result() -> void:
	if recording == null:
		return
	var result = presentation_services.accept_record(recording)
	result_notice.text = result.message


func save_checkpoint() -> void:
	if recording != null and recording.origin == "sandbox":
		var error = presentation_services.save_record(recording)
		show_reading(
			"Save sandbox",
			(
				"Experiment saved in a separate slot. The original weekend is unchanged."
				if error.is_empty()
				else error
			),
			weekend_menu
		)
	else:
		super.save_checkpoint()


func unapplied_draft_kinds() -> Array[String]:
	var kinds = super.unapplied_draft_kinds()
	if practice_panel and practice_panel.has_user_edits():
		kinds.append("practice")
	if duel_workspace and duel_workspace.panel.edited.values().has(true):
		kinds.append("tactical plan")
	return kinds
